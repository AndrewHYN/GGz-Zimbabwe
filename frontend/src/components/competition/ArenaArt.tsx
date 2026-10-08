export function ArenaArt() {
  return (
    <div className="arena-art" aria-hidden="true">
      <div className="arena-grid" />
      <div className="arena-orbit orbit-one" />
      <div className="arena-orbit orbit-two" />
      <div className="arena-spark spark-one" />
      <div className="arena-spark spark-two" />
      <div className="arena-monogram">
        GG<span>z</span>
      </div>
      <div className="arena-tag tag-top">PLAYER / PLAYER</div>
      <div className="arena-tag tag-bottom">ZW · LOCAL MULTIPLAYER</div>
      <div className="arena-cross cross-one">+</div>
      <div className="arena-cross cross-two">+</div>
    </div>
  );
}
