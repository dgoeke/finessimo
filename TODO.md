Library considerations:

[X] Add Robot for game state
[ ] Add tinykeys for input
[ ] Add Lit for DOM rendering
[ ] Add ts-pattern for reducer

Implementation TODOs (confirm before changing defaults):

- [ ] Align default timing values across reducer, state machine, and UI (or initialize state machine from reducer timing on init) to avoid transient mismatches.
- [ ] Consider removing KeyboardInputHandler.frameCounter (SMIH tracks frame count internally) to reduce redundancy.
- [ ] Review duplicate timestamp stamping in StateMachineInputHandler.processActions; we pass timestampMs through already.
- [ ] Revisit whether movement raw EnqueueInput should be logged at all (currently for analytics only) to avoid confusion; ensure tests cover intended source of movement for finesse.
