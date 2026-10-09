import { useEffect, useState } from "react";
// Follow the visible viewport, including iOS keyboard panning and Android resize.
export function useChatViewport() {
  const measure = () => ({
    height: window.visualViewport?.height ?? window.innerHeight,
    top: window.visualViewport?.offsetTop ?? 0,
  });
  const [viewport, setViewport] = useState(measure);
  useEffect(() => {
    const update = () => setViewport(measure());
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return viewport;
}
