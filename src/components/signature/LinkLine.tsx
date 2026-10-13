import React from "react";

export type LinkStyle = "normal" | "resource" | "bottleneck" | "simulated";

interface LinkLineProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  styleType?: LinkStyle;
  curvature?: number; // 0 to 1
  isActive?: boolean;
  pulsePhoton?: boolean;
  className?: string;
}

export const LinkLine: React.FC<LinkLineProps> = ({
  startX,
  startY,
  endX,
  endY,
  styleType = "normal",
  curvature = 0.4,
  isActive = true,
  pulsePhoton = true,
  className = "",
}) => {
  // Compute smooth cubic Bézier control points
  const dx = endX - startX;
  const dy = endY - startY;
  const cx1 = startX + dx * curvature;
  const cy1 = startY;
  const cx2 = endX - dx * curvature;
  const cy2 = endY;

  const pathD = `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;

  const getStyleConfig = () => {
    switch (styleType) {
      case "normal":
        return {
          stroke: "#6C4CF1",
          strokeWidth: 2.5,
          filter: "drop-shadow(0 0 6px rgba(108,76,241,0.5))",
          strokeDasharray: undefined,
          photonColor: "#9B82FF",
        };
      case "resource":
        return {
          stroke: "#16C1B0",
          strokeWidth: 2.5,
          filter: "drop-shadow(0 0 6px rgba(22,193,176,0.5))",
          strokeDasharray: undefined,
          photonColor: "#4FE7D8",
        };
      case "bottleneck":
        return {
          stroke: "#E5484D",
          strokeWidth: 3,
          filter: "drop-shadow(0 0 8px rgba(229,72,77,0.6))",
          strokeDasharray: "6 4",
          photonColor: "#FF7377",
          animationClass: "animate-pulse",
        };
      case "simulated":
        return {
          stroke: "#F59A23",
          strokeWidth: 2,
          filter: "drop-shadow(0 0 4px rgba(245,154,35,0.4))",
          strokeDasharray: "4 4",
          photonColor: "#FFC278",
        };
    }
  };

  const config = getStyleConfig();
  const pathId = `path-${Math.round(startX)}-${Math.round(startY)}-${Math.round(endX)}-${Math.round(endY)}`;

  return (
    <g className={`transition-all duration-300 ${className}`}>
      {/* Base Path */}
      <path
        id={pathId}
        d={pathD}
        fill="none"
        stroke={config.stroke}
        strokeWidth={config.strokeWidth}
        strokeDasharray={config.strokeDasharray}
        style={{ filter: config.filter }}
        className={config.animationClass}
      />

      {/* Flowing Laser Photon (Signature element D4: ลำแสงวิ่งตามเส้น) */}
      {isActive && pulsePhoton && (
        <circle r="4" fill={config.photonColor} className="filter drop-shadow-md">
          <animateMotion
            dur={styleType === "bottleneck" ? "1.5s" : "2.4s"}
            repeatCount="indefinite"
            path={pathD}
          />
        </circle>
      )}
    </g>
  );
};
