import { delay, isCdt } from "../../common/utils/utils.js";
import { LogType, StatusTask } from "../../typing";

export default class TaskQueue {
    priorityQueue: [string, any[] | StatusTask, boolean][] | undefined;
    queue: [string, any[] | StatusTask, boolean][] = [];
    isExecuting: boolean = false;
    _writeLog: (log: string, type?: LogType) => void;
    constructor(_writeLog: (log: string, type?: LogType) => void) {
        this._writeLog = _writeLog;
    }
    addTask(taskType: string, args: any[] | StatusTask, options: {
        isUnshift?: boolean, isDmg?: boolean, addAfterNonDmg?: boolean, isPriority?: boolean,
    } = {}) {
        const { isUnshift = false, isDmg = false, addAfterNonDmg = false, isPriority = false } = options;
        if (isPriority && this.priorityQueue == undefined) this.priorityQueue = [];
        const curQueue = isCdt(this.isExecuting || isPriority, this.priorityQueue) ?? this.queue;
        if (curQueue.some(([tpn]) => tpn == taskType)) {
            console.trace('重复task:', taskType);
        }
        if (isUnshift || isPriority) curQueue.unshift([taskType, args, isDmg]);
        else if (addAfterNonDmg) {
            const tidx = this.queue.findIndex(([_, _t, isDmg]) => isDmg);
            if (tidx > -1) this.queue.splice(tidx, 0, [taskType, args, isDmg]);
            else this.queue.push([taskType, args, isDmg]);
        } else curQueue.push([taskType, args, isDmg]);
        const queueList = `(${this.priorityQueue ? `priorityQueue=[${this.priorityQueue.map(v => v[0])}],` : ''}queue=[${this.queue.map(v => v[0])}])`;
        this._writeLog((isUnshift ? 'unshift' : 'add') + 'Task-' + taskType + queueList, 'emit');
    }
    async execTask(taskType: string, funcs: [() => void | Promise<void | boolean>, number?, number?][]) {
        this._writeLog('execTask-' + taskType, 'emit');
        console.time('execTask-end-' + taskType);
        if (!this.priorityQueue && this.queue.length > 0) {
            this.priorityQueue = [];
        }
        let res = true;
        for (const [func, after = 0, before = 0] of funcs) {
            await delay(before);
            res = !!await func();
            await delay(after);
        }
        this.isExecuting = true;
        console.timeEnd('execTask-end-' + taskType);
        return res;
    }
    getTask(): [[string, any[] | StatusTask, boolean], boolean] {
        const isPriority = (this.priorityQueue?.length ?? 0) > 0;
        const res = this.priorityQueue?.shift() ?? this.queue.shift();
        if (!res) return [['not found', [], false], false];;
        this._writeLog(`getTask:${res[0]}(${this.priorityQueue ? `priorityQueue=[${this.priorityQueue.map(v => v[0])}],` : ''}queue=[${this.queue.map(v => v[0])}])`, 'emit');
        if (this.priorityQueue?.length == 0) {
            this.priorityQueue = undefined;
        }
        return [res, isPriority];
    }
    isTaskEmpty() {
        return (this.priorityQueue ?? []).length == 0 && this.queue.length == 0;
    }
    addStatusAtk(ststask: StatusTask[], isUnshift = false, isPriority = false) {
        if (ststask.length == 0) return;
        for (const t of ststask) {
            const atkname = `statusAtk-${t.name}(${t.entityId})-p${t.pidx}h${t.hidx}:${t.trigger}`;
            this.addTask(atkname, t, { isUnshift, isPriority, isDmg: true });
        }
    }
}
