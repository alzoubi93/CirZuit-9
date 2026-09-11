import React from "react";
import logoUrl from "@/assets/images/cirzuit_logo_dark_1782591482615.jpg";

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "w-full h-full" }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt="CirZuit Logo"
      className={`object-contain rounded-xl ${className}`}
      referrerPolicy="no-referrer"
    />
  );
}
