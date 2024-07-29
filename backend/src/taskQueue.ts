import { delay } from "../../common/utils/utils.js";
import { StatusTask } from "../../typing";

export default class TaskQueue {
    queue: [string, any[] | StatusTask][] = [];
    isExecuting: boolean = false;
    constructor() { }
    addTask(taskType: string, args: any[], isUnshift: boolean = false) {
        if (this.queue.some(([tpn]) => tpn == taskType)) return;
        if (isUnshift) this.queue.unshift([taskType, args]);
        else this.queue.push([taskType, args]);
        console.info((isUnshift ? 'unshift' : 'add') + 'Task-' + taskType + `(queue=[${this.queue.map(v => v[0])}])`);
    }
    execTask(taskType: string, funcs: [() => void, number?][]) {
        return new Promise<void>(async resolve => {
            // await delay(800);
            for (const [func, intvl = 0] of funcs) {
                func();
                await delay(intvl);
            }
            this.isExecuting = true;
            console.info('execTask-' + taskType);
            resolve();
        });
    }
    getTask() {
        const res = this.queue.shift();
        if (!res) return;
        console.info(`getTask:${res[0]}(queue=[${this.queue.map(v => v[0])}])`);
        return res;
    }
    isTaskEmpty() {
        return this.queue.length == 0;
    }
    addStatusAtk(ststask: StatusTask[], isUnshift = false) {
        if (ststask.length == 0) return;
        for (const t of ststask) {
            const atkname = `statusAtk-${t.id}(${t.entityId})-p${t.pidx}h${t.hidx}`;
            if (this.queue.some(([tpn]) => tpn == atkname)) {
                console.warn('重复status:', atkname);
                continue;
            }
            if (isUnshift) this.queue.unshift([atkname, t]);
            else this.queue.push([atkname, t]);
        }
        console.info(`${isUnshift ? 'unshift' : 'add'}StatusAtk(queue=[${this.queue.map(v => v[0])}])`);
    }
}
