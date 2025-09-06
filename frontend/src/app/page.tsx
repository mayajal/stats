'use client';

import React from "react";
import Link from "next/link"; // Changed from "react-router-dom"
import { FaRobot, FaCheckCircle, FaThLarge, FaClone, FaLayerGroup, FaBug, FaBoxes,FaAsterisk } from "react-icons/fa";

const features = [
  {
    icon: <FaRobot style={{ fontSize: "1.5rem", color: "#2563eb" }} />, 
    title: "AI Statistical Guide",
    button: "Start Chatting",
    link: "/guide",
  },
  {
    icon: <FaCheckCircle style={{ fontSize: "1.5rem", color: "#22c55e" }} />,
    title: "Data Quality Check",
    button: "Start Analysis",
    link: "/data-quality",
  },
  {
    icon: <FaThLarge style={{ fontSize: "1.5rem", color: "#a21caf" }} />,
    title: "RCBD Analysis",
    button: "Start RCBD Analysis",
    link: "/rbd",
  },
  {
    icon: <FaClone style={{ fontSize: "1.5rem", color: "#ec4899" }} />,
    title: "FRBD Analysis",
    button: "Start FRBD Analysis",
    link: "/frbd",
  },
  {
    icon: <FaBoxes style={{ fontSize: "1.5rem", color: "#14b8a6" }} />,
    title: "Non-Parametric Tests",
    button: "Start Analysis",
    link: "/non-parametric",
  },
  {
    icon: <FaLayerGroup style={{ fontSize: "1.5rem", color: "#edb83dff" }} />,
    title: "Split Plot Analysis",
    text: "Coming Soon",
    button: "Start Analysis",
    link: "#",
  },
  {
    icon: <FaBug style={{ fontSize: "1.5rem", color: "#e719ddff" }} />,
    title: "Probit Analysis",
    button: "Start Analysis",
    link: "/probit",
  },
  {
    icon: <FaAsterisk style={{ fontSize: "1.5rem", color: "#ef4444" }} />,
    title: "Survival Analysis",
    button: "Start Analysis",
    link: "/survival",
  },
];

const StatVizHome: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4">
      <header className="mt-8 mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Welcome to VITA</h1>
        <p className="text-gray-500 text-lg">Your AI-Powered Statistical Guide & Analysis Tool</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {features.map((f, i) => (
          <section
            key={i}
            className="rounded-2xl bg-white shadow-sm hover:shadow-lg transition-shadow duration-200 p-7 flex flex-col items-start min-h-[150px]"
          >
            <div className="mb-4">{f.icon}</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">{f.title}</h2>
            <p className="text-gray-400 text-lg mb-2">{f.text}</p>
            <Link
              href={f.link}
              className="mt-auto px-5 py-2 rounded-lg bg-[#004aad] hover:bg-[#003a9d] text-white font-semibold transition-colors w-full shadow-sm text-center"
            >
              {f.button}
            </Link>
          </section>
        ))}
      </main>
    </div>
  );
};

export default StatVizHome;
