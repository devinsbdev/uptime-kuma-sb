const { log, exit, connectDb } = require("./util-worker");
const { R } = require("redbean-node");
const { setSetting, setting } = require("../util-server");

const DEFAULT_KEEP_PERIOD = 180;

(async () => {
    await connectDb();

    let period = await setting("keepDataPeriodDays");

    // Set Default Period
    if (period == null) {
        await setSetting("keepDataPeriodDays", DEFAULT_KEEP_PERIOD, "general");
        period = DEFAULT_KEEP_PERIOD;
    }

    // Try parse setting
    let parsedPeriod;
    try {
        parsedPeriod = parseInt(period);
    } catch (_) {
        log("Failed to parse setting, resetting to default..");
        await setSetting("keepDataPeriodDays", DEFAULT_KEEP_PERIOD, "general");
        parsedPeriod = DEFAULT_KEEP_PERIOD;
    }

    if (parsedPeriod < 1) {
        log(`Data deletion has been disabled as period is less than 1. Period is ${parsedPeriod} days.`);
    } else {

        log(`Clearing Data older than ${parsedPeriod} days...`);

        try {
            await R.exec(
                "DELETE FROM ?? WHERE ?? < DATETIME('now', '-' || ? || ' days') ",
                'heartbeat',
                'time',
                [ parsedPeriod ]
            );
        } catch (e) {
            log(`Failed to clear old data: ${e.message}`);
        }
    }

    exit();
})();
