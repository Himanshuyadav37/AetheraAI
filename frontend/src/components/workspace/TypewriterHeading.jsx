import React, { useState, useEffect } from "react";

export default function TypewriterHeading({ titles, speed = 35, deleteSpeed = 20, delayBetween = 4000 }) {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [blink, setBlink] = useState(true);

  // Blinking cursor effect
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Typewriter typing / deleting logic
  useEffect(() => {
    if (!titles || titles.length === 0) return;

    const currentTitle = titles[index];

    if (isDeleting) {
      if (subIndex === 0) {
        setIsDeleting(false);
        setIndex((prev) => (prev + 1) % titles.length);
        return;
      }
      const timeout = setTimeout(() => {
        setSubIndex((prev) => prev - 1);
      }, deleteSpeed);
      return () => clearTimeout(timeout);
    } else {
      if (subIndex === currentTitle.length) {
        const timeout = setTimeout(() => {
          setIsDeleting(true);
        }, delayBetween);
        return () => clearTimeout(timeout);
      }
      const timeout = setTimeout(() => {
        setSubIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [subIndex, index, isDeleting, titles, speed, deleteSpeed, delayBetween]);

  const currentText = titles[index] ? titles[index].substring(0, subIndex) : "";

  return (
    <h1
      className="hero-gradient-title"
      style={{
        minHeight: "1.2em",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center"
      }}
    >
      <span>{currentText}</span>
      <span
        style={{
          opacity: blink ? 1 : 0,
          marginLeft: "4px",
          color: "rgba(255, 255, 255, 0.7)",
          fontWeight: 300,
          transition: "opacity 0.1s ease"
        }}
      >
        |
      </span>
    </h1>
  );
}
