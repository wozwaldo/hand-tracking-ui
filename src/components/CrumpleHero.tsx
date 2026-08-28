import { useEffect, useRef, useState } from "react";
import HandCrumple from "./HandCrumple";
import "./CrumpleHero.css";

const PORTFOLIO_URL = "https://berilbtn.vercel.app";
const README_URL = "https://github.com/wozwaldo/hand-tracking-ui/blob/main/README.md";

type CameraState = "awaiting_permission" | "live";

const CrumpleHero = () => {
    const rootRef = useRef<HTMLElement>(null);
    const [cameraState, setCameraState] = useState<CameraState>("awaiting_permission");

    // HandCrumple is a black box: detect the live feed from the outside by
    // listening to its webcam <video> instead of touching its internals.
    useEffect(() => {
        const cam = rootRef.current?.querySelector<HTMLVideoElement>(".hc-cam video");
        if (!cam) return;

        const onPlaying = () => setCameraState("live");
        cam.addEventListener("playing", onPlaying);
        if (cam.readyState >= 2 && !cam.paused) onPlaying();

        return () => cam.removeEventListener("playing", onPlaying);
    }, []);

    const live = cameraState === "live";

    return (
        <main ref={rootRef} className="hero" data-camera={cameraState}>
            <a className="hero__link" href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer">
                DEV PORTFOLIO ↗
            </a>

            <h1 className="hero__title">
                Make a fist <br />to crumple me
            </h1>

            <p className="hero__note">
                MediaPipe Hand Landmarker → 21 landmarks per frame<br />
                Fist score: fingertip–palm distances, scale-normalized, EMA-smoothed<br />
                Score scrubs an all-keyframe video via currentTime<br />
                <a className="hero__readme" href={README_URL} target="_blank" rel="noopener noreferrer">README.md ↗</a>
            </p>

            {/* Webcam module chrome — overlays HandCrumple's .hc-cam box in the same grid area */}
            <div className="cam-frame" aria-hidden="true">
                <span className="cam-frame__cross cam-frame__cross--h" />
                <span className="cam-frame__cross cam-frame__cross--v" />
                {!live && <span className="cam-frame__label">AWAITING CAM</span>}
            </div>

            <HandCrumple />
        </main>
    );
};

export default CrumpleHero;
