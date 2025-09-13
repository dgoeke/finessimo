// High-level integration scaffolds spanning control → engine step pipeline

describe("Engine integration — common scenarios", () => {
  test.todo(
    "Spawn → move → rotate → soft drop → lock by timeout → clear lines → spawn next — events occur in canonical order on specific ticks",
  );

  test.todo(
    "Hard drop T-spin single: rotation classification should be 'floor' once kickOffset is available; emits Locked{hardDrop} and LinesCleared[<row>]",
  );

  test.todo(
    "Hold on first active piece: only allowed once per piece; subsequent Hold is ignored until next spawn",
  );

  test.todo(
    "Top-out path: fill the spawn area, step once, expect TopOut event and no active piece",
  );
});
