import Capacitor
import HealthKit

/// Apple Health, read-only: workouts (Apple Watch's and other apps'), heart rate, and active calories. Forge never writes
/// to Health. Times go in and out as milliseconds since 1970; days as "YYYY-MM-DD" in the phone's time zone.
/// Health never says whether reading was allowed: when it wasn't, queries just come back empty.
@objc(HealthPlugin)
public class HealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthPlugin"
    public let jsName = "Health"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "workouts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "heartRate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "activeEnergy", returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()
    private let bpm = HKUnit.count().unitDivided(by: .minute())
    private let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate)!
    private let energyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!
    private let walkingRunning = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!
    private let cycling = HKObjectType.quantityType(forIdentifier: .distanceCycling)!

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    /// Shows Health's permission sheet the first time; later calls resolve at once. Resolves even when you allow nothing.
    @objc func requestAccess(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { return call.reject("Apple Health isn't available on this device.") }
        let read: Set<HKObjectType> = [HKObjectType.workoutType(), heartRateType, energyType, walkingRunning, cycling]
        store.requestAuthorization(toShare: nil, read: read) { _, error in
            if let error { call.reject("Couldn't ask for Apple Health access.", nil, error) } else { call.resolve() }
        }
    }

    /// Workouts that started at or after `since`, oldest first (at most 200), each with its calories, distance, and
    /// heart rate summary.
    @objc func workouts(_ call: CAPPluginCall) {
        let since = Date(timeIntervalSince1970: (call.getDouble("since") ?? 0) / 1000)
        let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictStartDate)
        let oldestFirst = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: 200, sortDescriptors: [oldestFirst]) { _, samples, error in
            if let error { return call.reject("Couldn't read workouts from Apple Health.", nil, error) }
            let workouts = (samples as? [HKWorkout]) ?? []
            let group = DispatchGroup()
            var results = [[String: Any]?](repeating: nil, count: workouts.count)
            let lock = NSLock()
            for (i, workout) in workouts.enumerated() {
                group.enter()
                self.summary(of: workout) { result in
                    lock.lock()
                    results[i] = result
                    lock.unlock()
                    group.leave()
                }
            }
            group.notify(queue: .global()) { call.resolve(["workouts": results.compactMap { $0 }]) }
        }
        store.execute(query)
    }

    /// Heart rate from `start` to `end`, averaged into 30-second steps: [{ s: seconds from start, bpm }].
    @objc func heartRate(_ call: CAPPluginCall) {
        guard let startMs = call.getDouble("start"), let endMs = call.getDouble("end") else { return call.reject("Pass start and end.") }
        let start = Date(timeIntervalSince1970: startMs / 1000)
        let end = Date(timeIntervalSince1970: endMs / 1000)
        let query = HKStatisticsCollectionQuery(
            quantityType: heartRateType,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end, options: []),
            options: .discreteAverage,
            anchorDate: start,
            intervalComponents: DateComponents(second: 30))
        query.initialResultsHandler = { _, collection, error in
            if let error { return call.reject("Couldn't read heart rate from Apple Health.", nil, error) }
            var points: [[String: Any]] = []
            collection?.enumerateStatistics(from: start, to: end) { stats, _ in
                if let average = stats.averageQuantity()?.doubleValue(for: self.bpm) {
                    points.append(["s": Int(stats.startDate.timeIntervalSince(start)), "bpm": Int(average.rounded())])
                }
            }
            call.resolve(["points": points])
        }
        store.execute(query)
    }

    /// Active calories (the Move ring) for each day from `from` to `to` (YYYY-MM-DD, inclusive): [{ date, kcal }].
    @objc func activeEnergy(_ call: CAPPluginCall) {
        guard let from = call.getString("from").flatMap(Self.day.date(from:)), let to = call.getString("to").flatMap(Self.day.date(from:)) else {
            return call.reject("Pass from and to as YYYY-MM-DD.")
        }
        let end = Calendar.current.date(byAdding: .day, value: 1, to: to)!
        let query = HKStatisticsCollectionQuery(
            quantityType: energyType,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: from, end: end, options: []),
            options: .cumulativeSum,
            anchorDate: from,
            intervalComponents: DateComponents(day: 1))
        query.initialResultsHandler = { _, collection, error in
            if let error { return call.reject("Couldn't read active calories from Apple Health.", nil, error) }
            var days: [[String: Any]] = []
            collection?.enumerateStatistics(from: from, to: end) { stats, _ in
                if let kcal = stats.sumQuantity()?.doubleValue(for: .kilocalorie()) {
                    days.append(["date": Self.day.string(from: stats.startDate), "kcal": kcal.rounded()])
                }
            }
            call.resolve(["days": days])
        }
        store.execute(query)
    }

    // One workout's summary. Totals come from the samples in its time window (what the Watch recorded during it), so
    // this works without the newer per-workout statistics API.
    private func summary(of workout: HKWorkout, done: @escaping ([String: Any]) -> Void) {
        let window = HKQuery.predicateForSamples(withStart: workout.startDate, end: workout.endDate, options: [])
        let activity = Self.activity(workout.workoutActivityType)
        var result: [String: Any] = [
            "uuid": workout.uuid.uuidString,
            "activity": activity,
            "start": workout.startDate.timeIntervalSince1970 * 1000,
            "end": workout.endDate.timeIntervalSince1970 * 1000,
            "source": workout.sourceRevision.source.name,
        ]
        let lock = NSLock()
        let group = DispatchGroup()
        func ask(_ type: HKQuantityType, _ options: HKStatisticsOptions, _ read: @escaping (HKStatistics) -> Void) {
            group.enter()
            store.execute(HKStatisticsQuery(quantityType: type, quantitySamplePredicate: window, options: options) { _, stats, _ in
                if let stats {
                    lock.lock()
                    read(stats)
                    lock.unlock()
                }
                group.leave()
            })
        }
        // A missing value stays out of the result (JavaScript sees undefined), never an Optional.
        ask(energyType, .cumulativeSum) { stats in
            if let kcal = stats.sumQuantity()?.doubleValue(for: .kilocalorie()) { result["activeCalories"] = kcal.rounded() }
        }
        ask(heartRateType, [.discreteAverage, .discreteMax]) { stats in
            if let average = stats.averageQuantity()?.doubleValue(for: self.bpm) { result["avgHeartRate"] = Int(average.rounded()) }
            if let max = stats.maximumQuantity()?.doubleValue(for: self.bpm) { result["maxHeartRate"] = Int(max.rounded()) }
        }
        let distanceType: HKQuantityType? = activity == "cycling" ? cycling : ["running", "walking"].contains(activity) ? walkingRunning : nil
        if let distanceType {
            ask(distanceType, .cumulativeSum) { stats in
                if let miles = stats.sumQuantity()?.doubleValue(for: .mile()) { result["distanceMiles"] = miles }
            }
        }
        group.notify(queue: .global()) { done(result) }
    }

    private static func activity(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return "running"
        case .walking, .hiking: return "walking"
        case .cycling: return "cycling"
        case .rowing: return "rowing"
        case .elliptical: return "elliptical"
        case .traditionalStrengthTraining, .functionalStrengthTraining, .coreTraining: return "strength"
        case .highIntensityIntervalTraining, .mixedCardio, .crossTraining: return "hiit"
        case .stairClimbing, .stairs: return "stairs"
        case .swimming: return "swimming"
        case .yoga, .pilates, .flexibility, .mindAndBody: return "yoga"
        default: return "other"
        }
    }

    private static let day: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
