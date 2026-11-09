/** What shows while a page's data loads: the shape of the results, so nothing jumps when they arrive. */
export default function Loading() {
  return (
    <main className="page" aria-busy="true">
      <div className="cards">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="card skeleton">
            <div className="ph" />
            <div className="cbody">
              <i />
              <i />
              <i />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
