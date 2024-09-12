import { delay } from "../../common/utils/utils.js";
import { StatusTask } from "../../typing";

export default class TaskQueue {
    priorityQueue: [string, any[] | StatusTask][] | undefined;
    queue: [string, any[] | StatusTask][] = [];
    isExecuting: boolean = false;
    constructor() { }
    addTask(taskType: string, args: any[] | StatusTask, isUnshift: boolean = false) {
        const curQueue = this.priorityQueue ?? this.queue;
        if (curQueue.some(([tpn]) => tpn == taskType)) {
            console.warn('重复task:', taskType);
            if (!this.priorityQueue) return;
        }
        if (isUnshift) this.queue.unshift([taskType, args]);
        else curQueue.push([taskType, args]);
        const queueList = `(${this.priorityQueue ? `priorityQueue=[${this.priorityQueue.map(v => v[0])}],` : ''}queue=[${this.queue.map(v => v[0])}])`;
        console.info((isUnshift ? 'unshift' : 'add') + 'Task-' + taskType + queueList);
    }
    async execTask(taskType: string, funcs: [() => void | Promise<void | boolean>, number?, number?][], isPriority: boolean) {
        console.info('execTask-' + taskType);
        if (!isPriority && !this.priorityQueue && this.queue.length > 0) {
            this.priorityQueue = [];
        }
        let res = true;
        for (const [func, after = 0, before = 0] of funcs) {
            await delay(before);
            res = !!await func();
            await delay(after);
        }
        this.isExecuting = true;
        return res;
    }
    getTask(): [[string, any[] | StatusTask], boolean] {
        const isPriority = (this.priorityQueue?.length ?? 0) > 0;
        const res = this.priorityQueue?.shift() ?? this.queue.shift();
        if (!res) return [['not found', []], false];
        console.info(`getTask:${res[0]}(${this.priorityQueue ? `priorityQueue=[${this.priorityQueue.map(v => v[0])}],` : ''}queue=[${this.queue.map(v => v[0])}])`);
        if (this.priorityQueue?.length == 0) {
            this.priorityQueue = undefined;
        }
        return [res, isPriority];
    }
    isTaskEmpty() {
        return (this.priorityQueue ?? []).length == 0 && this.queue.length == 0;
    }
    addStatusAtk(ststask: StatusTask[], isUnshift = false) {
        if (ststask.length == 0) return;
        for (const t of ststask) {
            const atkname = `statusAtk-${t.name}(${t.entityId})-p${t.pidx}h${t.hidx}:${t.trigger}`;
            this.addTask(atkname, t, isUnshift);
        }
    }
}
