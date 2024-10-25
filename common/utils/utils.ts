import { BLCOK_WORDS } from "../constant/gameOption.js";

/**
 * 深拷贝函数
 * @param obj 要拷贝的对象
 * @returns 拷贝后的对象
 */
export function clone<T>(obj: T): T {
    const cache = new Map();
    function _clone<T>(_obj: T): T {
        if (typeof _obj !== 'object' || _obj === null) {
            return _obj;
        }
        if (cache.has(_obj)) {
            return cache.get(_obj);
        }
        if (Array.isArray(_obj)) {
            return _obj.map(item => _clone(item)) as unknown as T;
        }
        const cloneObj = {} as T;
        cache.set(_obj, cloneObj);
        Object.setPrototypeOf(cloneObj, Object.getPrototypeOf(_obj));
        for (const key in _obj) {
            if (_obj.hasOwnProperty(key)) {
                cloneObj[key] = _clone(_obj[key]);
            }
        }
        return cloneObj;
    }
    return _clone(obj);
}

/**
 * 符合条件就返回，否则返回undefined
 * @param cdt 条件
 * @param res 返回的值
 * @param elres 否则返回的值
 */
export const isCdt = <T>(cdt: boolean | null | undefined | (() => boolean | null | undefined), res: T | (() => T), elres?: T): T | undefined => {
    if (typeof cdt == 'function') cdt = cdt();
    if (cdt) {
        if (typeof res == 'function') return (res as () => T)();
        return res;
    }
    if (elres == undefined) return undefined;
    return elres as T;
}

/**
 * 生成分享码
 * @param ids 卡组中角色行动卡的id数组
 * @param salt 盐值
 * @returns 分享码
 */
export const genShareCode = (ids: number[], salt = 0): string => {
    const ostr = ids.map(id => id.toString(2).padStart(12, '0')).join('').padEnd(400, '0');
    const farr: number[] = [];
    for (let i = 0; i < 25; ++i) {
        farr.push((parseInt(ostr.slice(i * 8, (i + 1) * 8), 2) + salt) % 256);
        farr.push((parseInt(ostr.slice(i * 8 + 200, (i + 1) * 8 + 200), 2) + salt) % 256);
    }
    farr.push(salt);
    const res = btoa(String.fromCharCode(...farr));
    if (BLCOK_WORDS.some(v => v.test(res))) return genShareCode(ids, salt + 1);
    return res;
}

/**
 * 解析分享码
 * @param code 分享码
 * @returns 解析后对象 {heroIds: number[], cardIds: number[]}
 */
export const parseShareCode = (code: string): { heroIds: number[], cardIds: number[] } => {
    const salt = atob(code).split('').slice(-1)[0]?.charCodeAt(0) ?? 0;
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
        res.push(parseInt(str.slice(i * 12, (i + 1) * 12), 2));
    }
    return {
        heroIds: res.slice(0, 3),
        cardIds: res.slice(3).filter(v => v > 0),
    }
}

/**
 * 延迟函数
 * @param time 延迟时间(ms = 0)
 */
export const delay = (time: number = 0) => {
    if (time == 0) return;
    return new Promise<void>(resolve => {
        setTimeout(resolve, time);
    });
}

/**
 * 条件同步等待
 * @param cdt 条件
 * @param options.delay 符合条件后延迟时间(ms = 0)
 * @param options.freq 频率(ms = 500)
 * @param options.maxtime 最大等待时间(ms = 8000)
 * @param options.isImmediate 是否立即执行
 * @returns 
 */
export const wait = async (cdt: () => boolean, options: { delay?: number, freq?: number, maxtime?: number, isImmediate?: boolean } = {}) => {
    const { delay: dl = 0, freq = 500, maxtime = 8000, isImmediate = true } = options;
    let loop = 0;
    if (cdt() && isImmediate) return;
    let warn = false;
    while (true) {
        ++loop;
        await delay(freq);
        if (cdt()) {
            await delay(dl);
            break;
        }
        if (loop > 3e4 / freq && !warn) {
            console.trace('超过30秒，可能存在死循环');
            warn = true;
        }
        if (loop > maxtime / freq) throw new Error(`too many loops-${maxtime}ms: ${cdt.toString()}`);
    }
}

/**
 * 数组转对象
 * @param arr 数组
 * @param initValue 默认值
 * @returns 转换后的对象
 */
export const arrToObj = <K extends string | number | symbol, V>(arr: K[], initValue: V) => {
    return arr.reduce((acc, cur) => {
        acc[cur] = initValue;
        return acc;
    }, {} as Record<K, V>);
}

/**
 * 对象转数组
 * @param obj 对象
 * @returns 转换后的数组
 */
export const objToArr = <K extends string | number | symbol, V>(obj: Record<K, V>): [K, V][] => {
    return Object.keys(obj).map(k => [k as K, obj[k as K] as V]);
}

/**
 * 防抖函数
 * @param fn 执行函数
 * @param wait 防抖频率(ms = 100)
 */
export const debounce = (fn: (...args: any[]) => any, wait: number = 100) => {
    let timer: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn(...args);
            timer = null;
        }, wait);
    };
};

/**
 * 节流函数
 * @param fn 执行函数
 * @param interval 节流频率(ms = 100)
 */
export const throttle = (fn: (...args: any[]) => any, interval: number = 100) => {
    let lastTime = 0;
    return function (...args: any[]) {
        const now = new Date().getTime();
        const remainTime = interval - (now - lastTime);
        if (remainTime <= 0) {
            fn(...args);
            lastTime = now;
        }
    };
};

/**
 * 交换键值
 * @param obj 对象
 * @returns 交换后的对象
 */
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

/**
 * 获取数组最后一项
 * @param arr 数组
 * @returns 最后一项
 */
export const getLast = <T>(arr: T[]): T => arr[arr.length - 1];

/**
 * 不改变地址复制一个对象
 * @param target 目标对象
 * @param source 源对象
 */
export const assgin = <T>(target: T, source: T) => {
    if (target == source) source = clone(source);
    if (Array.isArray(target) && Array.isArray(source)) {
        const equal = (tar: any, src: any) => {
            if (src?.entityId !== undefined && src.entityId != -1) return src.entityId == tar.entityId;
            return src?.id !== undefined && src.id == tar.id;
        }
        const existObj = target.filter(tar => (source as (T & any[])).some(src => equal(src, tar)));
        target.length = 0;
        for (const src of source) {
            const tar = existObj.find(tar => equal(tar, src));
            if (tar === undefined) target.push(src);
            else {
                assgin(tar, src);
                target.push(tar);
            }
        }
        return;
    }
    for (const key in target) {
        !source?.hasOwnProperty(key) && delete target[key];
    }
    for (const key in source) {
        if (typeof source[key] === 'object' && source[key] !== null) assgin(target[key], source[key]);
        else target[key] = source[key];
    }
}
