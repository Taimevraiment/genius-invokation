import { delay, isCdt } from "../../common/utils/utils.js";
import { Env, LogType, TaskItem } from "../../typing";

const findLastIndex = <T>(arr: T[], predicate: (value: T, index: number, obj: T[]) => boolean) => {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (predicate(arr[i], i, arr)) return i;
    }
    return -1;
}

export default class TaskQueue {
    priorityQueue: TaskItem[] | undefined;
    queue: TaskItem[] = [];
    finalQueue: TaskItem[] = [];
    immediateQueue: TaskItem[] = [];
    isExecuting: boolean = false;
    isDieWaiting: boolean = false;
    canPreview: boolean = true;
    _writeLog: (log: string, type?: LogType) => void;
    env: Env;
    constructor(_writeLog: (log: string, type?: LogType) => void, env: Env) {
        this._writeLog = _writeLog;
        this.env = env;
    }
    get queueList() {
        const item = (name: string, q?: TaskItem[]) => q?.length || name == 'queue' ? `${name}=[${q?.map(v => v[0]) ?? ''}]` : '';
        return `(${item('immediateQueue', this.immediateQueue)}${item('priorityQueue', this.priorityQueue)}${item('queue', this.queue)}${item('finalQueue', this.finalQueue)})`;
    }
    init() {
        this.priorityQueue = undefined;
        this.queue = [];
        this.finalQueue = [];
        this.immediateQueue = [];
        this.isExecuting = false;
        this.isDieWaiting = false;
        this.canPreview = true;
    }
    addTask(taskType: string, args: any[] | (() => Promise<void>) | (() => void), options: {
        isUnshift?: boolean, isDmg?: boolean, addAfterNonDmg?: boolean, isPriority?: boolean, source?: number,
        orderAfter?: string, isFinal?: boolean, isImmediate?: boolean, delayAfter?: number, delayBefore?: number,
    } = {}) {
        if (!this.canPreview) return;
        const { isUnshift, isDmg = false, addAfterNonDmg, isPriority, isFinal, source = -1, orderAfter = '', isImmediate,
            delayAfter, delayBefore } = options;
        if (isPriority && this.priorityQueue == undefined) this.priorityQueue = [];
        const curQueue = isCdt(isImmediate, this.immediateQueue, isCdt(isFinal, this.finalQueue, isCdt(this.isExecuting || isPriority, this.priorityQueue))) ?? this.queue;
        // if (curQueue.some(([tpn]) => tpn == taskType && !tpn.includes('getdice-oppo'))) {
        //     console.info('重复task:', taskType);
        // }
        const queueTask: TaskItem = [taskType, typeof args != 'function' ? args : [[args, delayAfter, delayBefore]], source, isDmg];
        const tidx = addAfterNonDmg ? this.queue.findIndex(([, , , isdmg]) => isdmg) :
            orderAfter != '' ? findLastIndex(this.queue, ([taskType]) => taskType.includes(orderAfter)) : -1;
        if (addAfterNonDmg && tidx == -1) {
            if (isUnshift) this.queue.unshift(queueTask);
            else this.queue.push(queueTask);
        } else if (tidx > -1) this.queue.splice(tidx + (addAfterNonDmg ? 0 : 1), 0, queueTask);
        else {
            if (isUnshift) curQueue.unshift(queueTask);
            else curQueue.push(queueTask);
        }
        this._writeLog('addTask-' + (isUnshift ? 'unshift-' : isImmediate ? 'immediate-' : isFinal ? 'final-' : isPriority ? 'priotity-' : '') + taskType + this.queueList, 'emit');
    }
    async execTask(taskType: string, funcs: [() => any | Promise<any>, number?, number?][], isExec: boolean) {
        if (!this.canPreview) return;
        this._writeLog('execTask-start-' + taskType, 'emit');
        if (this.env == 'dev' && isExec) console.time('execTask-end-' + taskType);
        if (this.queue.length > 0) {
            if (!this.priorityQueue) this.priorityQueue = [];
            else this.queue.unshift(...this.priorityQueue.splice(0, this.priorityQueue.length + 1))
        }
        let duration = 0;
        for (const [func, after = -1, before = -1] of funcs) {
            if (this.env != 'test' && isExec) await delay(before);
            await func();
            if (this.env != 'test' && isExec) await delay(after);
            duration += Math.max(0, before) + Math.max(0, after);
        }
        this._writeLog(`execTask-end-${taskType}:${duration}ms`, 'emit');
        this.isExecuting = true;
        if (this.env == 'dev' && isExec) console.timeEnd('execTask-end-' + taskType);
    }
    getTask(): [TaskItem, boolean] {
        const isPriority = (this.priorityQueue?.length ?? 0) > 0;
        const res = this.immediateQueue.shift() ?? this.priorityQueue?.shift() ?? this.queue.shift() ?? this.finalQueue.shift();
        if (!res) return [['not found', [], -1, false], false];
        this._writeLog(`getTask:${res[0]}${this.queueList}`, 'emit');
        if (this.priorityQueue?.length == 0) {
            this.priorityQueue = undefined;
        }
        return [res, isPriority];
    }
    peekTask(): [TaskItem, boolean] {
        const isPriority = (this.priorityQueue?.length ?? 0) > 0;
        const res = this.immediateQueue?.[0] ?? this.priorityQueue?.[0] ?? this.queue?.[0] ?? this.finalQueue?.[0];
        if (!res) return [['not found', [], -1, false], false];
        return [res, isPriority];
    }
    removeTask(condition: { entityId?: number, source?: number }) {
        const { entityId, source = -1 } = condition;
        for (const queue of [this.immediateQueue, this.priorityQueue, this.queue, this.finalQueue]) {
            if (!queue) continue;
            const idxs = queue.map(([tpn, , src], idx) => ({ tpn, src, idx })).filter(({ tpn, src }) => {
                if (entityId) return tpn.includes(`${entityId}`);
                if (source != -1) return src == source;
                return false;
            }).map(v => v.idx).sort((a, b) => b - a);
            for (const idx of idxs) {
                this._writeLog(`removeTask:${queue[idx][0]}${this.queueList}`, 'emit');
                queue.splice(idx, 1);
            }
        }
    }
    isTaskEmpty() {
        return this.immediateQueue.length == 0 && (this.priorityQueue ?? []).length == 0 && this.queue.length == 0 && this.finalQueue.length == 0;
    }
    stopPreview() {
        this.canPreview = false;
        this.init();
    }
}
