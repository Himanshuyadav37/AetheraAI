import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

import {
  ArrowRight
} from "lucide-react";

import "./HeroSection.css";

function HeroSection() {

  const { user } = useAuth();

  const navigate = useNavigate();

  return (

    <section className="hero-card">

      <div className="hero-left">

        <div className="hero-badge">

          <span className="hero-dot"></span>

          <span>

            NexusAI AI Operating System

          </span>

        </div>

        <h1 className="hero-title">

          Welcome,

          <span>

            {" "}

            {user?.username || "Developer"}

          </span>

        </h1>

        <p className="hero-subtitle">

          Build intelligent solutions using NexusAI's ecosystem of specialized AI agents.

        </p>

        <p className="hero-description">

         NexusAI unifies Engineer, Conversational, Research, Education and Automation AI into one intelligent platform for building, learning, researching and automating with specialized AI agents.

        </p>

        <button

          className="generate-btn"

          onClick={() => navigate("/generate")}

        >

          <span>

            Generate Project

          </span>

          <ArrowRight size={18} />

        </button>

      </div>

      <div className="hero-background">

        <div className="glow glow-1"></div>

        <div className="glow glow-2"></div>

        <svg

          className="hero-lines"

          viewBox="0 0 800 350"

          preserveAspectRatio="none"

        >

          <path

            d="M0 250 C150 180 240 280 420 210 C560 150 650 110 800 160"

          />

          <path

            d="M0 310 C170 250 320 320 470 250 C620 180 710 210 800 185"

          />

          <path

            d="M120 350 C260 300 420 330 610 230 C690 190 760 180 800 160"

          />

        </svg>

      </div>

    </section>

  );

}

export default HeroSection;
