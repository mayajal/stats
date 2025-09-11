'use client';

import React from "react";
import Link from "next/link";
import { FaMixer, FaRobot, FaCheckCircle, FaThLarge, FaClone, FaLayerGroup, FaBug, FaBoxes,FaAsterisk } from "react-icons/fa";

const features = [
  {
    icon: <FaRobot style={{ fontSize: "1.5rem", color: "#2563eb" }} />,
    title: "AI Statistical Guide",
    link: "/guide",
  },
  {
    icon: <FaCheckCircle style={{ fontSize: "1.5rem", color: "#22c55e" }} />,
    title: "Data Quality Check",
    link: "/data-quality",
  },
  {
    icon: <FaThLarge style={{ fontSize: "1.5rem", color: "#a21caf" }} />,
    title: "RCBD Analysis",
    link: "/rbd",
  },
  {
    icon: <FaClone style={{ fontSize: "1.5rem", color: "#ec4899" }} />,
    title: "FRBD Analysis",
    link: "/frbd",
  },
  {
    icon: <FaMixer style={{ fontSize: "1.5rem", color: "#2563eb" }} />,
    title: "Linear Mixed Model",
    link: "/lmm",
  },
  {
    icon: <FaBoxes style={{ fontSize: "1.5rem", color: "#14b8a6" }} />,
    title: "Non-Parametric Tests",
    link: "/non-parametric",
  },
  {
    icon: <FaBug style={{ fontSize: "1.5rem", color: "#e719ddff" }} />,
    title: "Probit Analysis",
    link: "/probit",
  },
  {
    icon: <FaAsterisk style={{ fontSize: "1.5rem", color: "#ef4444" }} />,
    title: "Survival Analysis",
    link: "/survival",
  },
  {
    icon: <FaLayerGroup style={{ fontSize: "1.5rem", color: "#edb83dff" }} />,
    title: "Split Plot Analysis",
    text: "Coming Soon",
    link: "#",
  },
];

const StatVizHome: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-300 flex flex-col items-center px-4">
      <header className="mt-8 mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-black-800 mb-2">Welcome to VITA</h1>
        <p className="text-black-600 text-lg">Your AI-Powered Statistical Guide & Analysis Tool</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {features.map((feature, i) => {
          const isComingSoon = feature.link === '#';
          const card = (
            <section
              className={`rounded-2xl bg-white shadow p-3 p-5 flex flex-col items-start h-full ${
                isComingSoon
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:shadow-lg transition-shadow duration-200 cursor-pointer'
              }`}
            >
              <div className="mb-4">{feature.icon}</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">{feature.title}</h2>
              {feature.text && (
                <p className="text-gray-400 text-lg mt-auto">{feature.text}</p>
              )}
            </section>
          );

          if (isComingSoon) {
            return <div key={i}>{card}</div>;
          }

          return (
            <Link href={feature.link} key={i} className="no-underline">
              {card}
            </Link>
          );
        })}
      </main>
    </div>
  );
};

export default StatVizHome;