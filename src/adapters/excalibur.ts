// Optional sketch of how you'd wire this with Excalibur.js
// Not executable here; for reference only.
/*
import * as ex from "excalibur";
import { controlStep } from "../control/index";
import type { ControlState, KeyEdge } from "../control/types";
import { init, step } from "../engine/index";

const TPS = 120;
const game = new ex.Engine({ fixedUpdateFps: TPS });
let ctrl: ControlState = { leftDown:false, rightDown:false, softDropDown:false, activeDir:null, dasDeadlineTick:null, nextRepeatTick:null, cfg: { dasTicks: 10, arrTicks: 2 } };
let tick = 0 as any;
let { state } = init(/* cfg * /{} as any, tick);

game.on("preupdate", () => {
  // Collect key edges this tick from Excalibur input
  const edges: KeyEdge[] = []; // TODO: translate ex.Input to KeyEdge[]
  const { commands, next } = controlStep(ctrl, tick, edges);
  ctrl = next;
  const r = step(state, tick, commands);
  state = r.state; // render reads from this
  // events: r.events
  tick = (tick + 1) as any;
});

game.start();
*/
