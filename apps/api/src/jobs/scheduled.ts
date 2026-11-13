import { sweepExpiredSubmissions } from "../lib/retention";
import { dispatchNotices } from "../notices/submissionWaiting";
import { processDeliveries } from "../delivery/deliveries";
import { flushErrors, reportError } from "../errors/report";
import { pruneErrors } from "../errors/store";

const INTERVAL_MS = 10 * 60 * 1000;

/**
 * Everything that must happen without a request: delete what has expired,
 * send queued notices, retry and expire queued deliveries. Each job is also
 * run lazily somewhere else, so a missed round delays things and loses
 * nothing. None of them throw.
 */
export async function runScheduledWork(): Promise<{ notices: number; deliveries: number }> {
    await sweepExpiredSubmissions();
    const notices = await dispatchNotices();
    const deliveries = await processDeliveries();
    await flushErrors();
    await pruneErrors();
    return { notices, deliveries };
}

export function startScheduler(): NodeJS.Timeout {
    let running = false;
    const round = async () => {
        if (running) return;
        running = true;
        try {
            await runScheduledWork();
        } catch (e) {
            reportError(e, "job", "scheduled");
        } finally {
            running = false;
        }
    };
    void round();
    const timer = setInterval(round, INTERVAL_MS);
    timer.unref();
    return timer;
}
