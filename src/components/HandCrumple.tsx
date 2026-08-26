import { useRef, useEffect } from "react";  
import { HandLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";

const HandCrumple = () => {
    const camRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {

        let landmarker: HandLandmarker | null = null;
        let rafId = 0;
        let ctx: CanvasRenderingContext2D | null = null;

        const OPEN_RATIO = 2.0;
        const FIST_RATIO = 0.5;

        async function init () {
            if (!camRef.current || !canvasRef.current) return;
            
            // camera setup
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            camRef.current.srcObject = stream;

            // wasm files addresses
            const fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm")
           
            // landmarker setup
            landmarker = await HandLandmarker.createFromOptions(fileset, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                },
                runningMode: "VIDEO",
                numHands: 1, 
            });

            // context setup (bir kez alıyoruz, her frame için yeni bir context oluşturmamıza gerek yok)
            ctx = canvasRef.current.getContext("2d");


            function getFistScore (points: NormalizedLandmark[]): number{
                const palm = points [9];
                const tips = [points[8], points[12], points[16], points[20]];

                const avg = tips.reduce((sum, t) => sum + Math.hypot(t.x - palm.x, t.y - palm.y), 0) / 4;

                const ref = Math.hypot(points[0].x - palm.x, points[0].y - palm.y); // points[0] -> bilek
                const ratio = avg / ref;
                
                const score = (OPEN_RATIO - ratio) / (OPEN_RATIO - FIST_RATIO);
                return Math.min(1, Math.max(0, score)); // clamp deniyor -> güvenlik katmanı, negatif yada 1'den büyük çıkmasını engelliyor.
            }
            
            // request animation frame
            function loop () {
                if (camRef.current && landmarker && ctx && canvasRef.current && camRef.current.readyState >= 2) {
                    const result = landmarker.detectForVideo(
                        camRef.current,
                        performance.now()
                    );

                    const w = canvasRef.current.width;
                    const h = canvasRef.current.height;

                    ctx.clearRect(0, 0, w, h); // her frame için canvas'ı temizle

                    if (result.landmarks.length > 0) {
                        const points = result.landmarks[0]; // 21 points

                        // draw lines
                        ctx.strokeStyle = "#00ff88";
                        ctx.lineWidth = 2;
                        for (const conn of HandLandmarker.HAND_CONNECTIONS) {
                            const a = points[conn.start]; // start point
                            const b = points[conn.end]; // end point
                            ctx.beginPath();
                            ctx.moveTo(a.x * w, a.y * h);
                            ctx.lineTo(b.x * w, b.y * h);
                            ctx.stroke();
                        }

                        // draw circle
                        ctx.fillStyle = "#00ff88";
                        for (const p of points){
                            ctx.beginPath();
                            ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
                            ctx.fill();
                        }

                        const score = getFistScore(points);
                        ctx.font = "20px monospace";
                        ctx.fillStyle = "#ffffff";
                        ctx.fillText(score.toFixed(2), 10, 30);
                    }
                }
                rafId = requestAnimationFrame(loop);
            }
            loop();
        }

        init().catch((err) => console.error("Camera access failed:", err));

        // cleanup
        return () => cancelAnimationFrame(rafId);
    }, []);

    return (
        <div style={{ position: "relative", width: 480 }}>
             <video
                ref={camRef}
                autoPlay
                muted
                playsInline
                style={{ width: "100%" }}
            />
            <canvas 
                ref={canvasRef} 
                width={480}
                height={360}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
        </div>
       
    )
}

export default HandCrumple;

