import { Cmds } from "../../typing";

export default class CmdGenerator {

    private cmds: Cmds[] = [];
    constructor() { }

    static switch(hidx: number | 'after' | 'before', isOppo = false) {
        return new CmdGenerator().switch(hidx, isOppo);
    }

    switch(hidx: number | 'after' | 'before', isOppo = false) {
        if (hidx == 'after') this.cmds.push({ cmd: 'switch-after', isOppo });
        else if (hidx == 'before') this.cmds.push({ cmd: 'switch-before', isOppo });
        else this.cmds.push({ cmd: 'switch-to', hidxs: [hidx], isOppo });
        return this;
    }

    done() {
        return this.cmds;
    }
}

CmdGenerator.switch('after').done();