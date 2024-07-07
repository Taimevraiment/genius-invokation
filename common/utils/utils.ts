import CODE_IDX_LIST from "../constant/codeIdxList";

// 深拷贝函数
export function clone<T>(obj: T): T {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => clone(item)) as unknown as T;
    }
    const cloneObj = {} as T;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloneObj[key] = clone(obj[key]);
        }
    }
    return cloneObj;
}

// 符合条件就返回，否则返回undefined
export const isCdt = <T>(cdt: boolean | null | undefined, res: T, elres?: T): T | undefined => {
    if (cdt) return res;
    if (elres == undefined) return undefined;
    return elres;
}

// 生成分享码
export const genShareCode = (ids: number[], salt = 0): string => {
    const ostr = ids.map(id => (CODE_IDX_LIST.indexOf(id)).toString(2).padStart(12, '0')).join('').padEnd(400, '0');
    const farr: number[] = [];
    for (let i = 0; i < 25; ++i) {
        farr.push((parseInt(ostr.slice(i * 8, (i + 1) * 8), 2) + salt) % 256);
        farr.push((parseInt(ostr.slice(i * 8 + 200, (i + 1) * 8 + 200), 2) + salt) % 256);
    }
    farr.push(salt);
    return btoa(String.fromCharCode(...farr));
}

// 解析分享码
export const parseShareCode = (code: string): { heroIds: number[], cardIds: number[] } => {
    const salt = atob(code).split('').at(-1)?.charCodeAt(0) ?? 0;
    const ores = atob(code).split('').map(v => ((v.charCodeAt(0) - salt + 256) % 256).toString(2).padStart(8, '0')).join('');
    let str1 = '';
    let str2 = '';
    for (let i = 0; i < 50; i += 2) {
        str1 += ores.slice(i * 8, (i + 1) * 8);
        str2 += ores.slice((i + 1) * 8, (i + 2) * 8);
    }
    const str = str1 + str2;
    const res: number[] = [];
    for (let i = 0; i < 33; ++i) {
        res.push(CODE_IDX_LIST[parseInt(str.slice(i * 12, (i + 1) * 12), 2)]);
    }
    const heroIds = res.slice(0, 3);
    const cardIds = res.slice(3).filter(v => v > 0);
    return { heroIds, cardIds }
}

// 延迟函数
export const delay = (time: number = 0) => {
    if (time == 0) return;
    return new Promise<void>(resolve => {
        setTimeout(resolve, time);
    });
}

// 条件同步等待
export const wait = async (cdt: () => boolean, options: { delay?: number, freq?: number, maxtime?: number, isImmediate?: boolean } = {}) => {
    const { delay: dl = 2000, freq = 500, maxtime = 8000, isImmediate = true } = options;
    let loop = 0;
    if (cdt() && isImmediate) return;
    while (true) {
        ++loop;
        await delay(freq);
        if (cdt()) {
            await delay(dl);
            break;
        }
        if (loop > maxtime / freq) throw new Error('too many loops: ' + cdt.toString());
    }
}

// 数组转对象
export const arrToObj = <K extends string | number | symbol, V>(arr: K[], initValue: V) => {
    return arr.reduce((acc, cur) => {
        acc[cur] = initValue;
        return acc;
    }, {} as Record<K, V>);
}

// 对象转数组
export const objToArr = <K extends string | number | symbol, V>(obj: Record<K, V>): [K, V][] => {
    return Object.keys(obj).map(k => [k as K, obj[k as K] as V]);
}

// 防抖函数
export const debounce = (fn: (...args: any[]) => any, wait: number = 100) => {
    let timer: NodeJS.Timeout | undefined;
    return (...args: any[]) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn(...args);
            timer = undefined;
        }, wait);
    };
};

// 交换键值
export const swapKeysAndValues = <K extends string | number | symbol, V extends string | number>(obj: Record<K, V>) => {
    const swapped: Record<V, K> = {} as Record<V, K>;
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            swapped[value] = key;
        }
    }
    return swapped;
}

// 获取数组最后一项
export const getLast = <T>(arr: T[]) => arr[arr.length - 1];

