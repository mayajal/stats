'use client';

import React from "react";
import Link from "next/link"; // Changed from "react-router-dom"
import { FaRobot, FaCheckCircle, FaThLarge, FaClone, FaLayerGroup, FaBug, FaBoxes } from "react-icons/fa";

const features = [
  {
    icon: <FaRobot className="text-2xl text-blue-600" />, 
    title: "AI Statistical Guide",
    button: "Start Chatting",
    link: "/guide",
  },
  {
    icon: <FaCheckCircle className="text-2xl text-green-600" />,
    title: "Data Quality Check",
    button: "Start Analysis",
    link: "/data-quality",
  },
  {
    icon: <FaThLarge className="text-2xl text-purple-600" />,
    title: "RBD Analysis",
    button: "Start RBD Analysis",
    link: "/rbd",
  },
  {
    icon: <FaClone className="text-2xl text-pink-600" />,
    title: "FRBD Analysis",
    button: "Start FRBD Analysis",
    link: "/frbd",
  },
  {
    icon: <FaLayerGroup className="text-2xl" style={{ color: "#edb83dff" }} />,
    title: "Split Plot Analysis",
    button: "Start Analysis",
    link: "/split-plot",
  },
  {
    icon: <FaBug className="text-2xl" style={{ color: "#e719ddff" }} />,
    title: "Probit Analysis",
    button: "Start Analysis",
    link: "/probit",
  },
];

const StatVizHome: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4">
      <header className="mt-8 mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Welcome to VITA</h1>
        <p className="text-gray-500 text-lg">Your AI-Powered Statistical Guide & Analysis Tool</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
        {features.map((f, i) => (
          <section
            key={i}
            className="rounded-2xl bg-white shadow-sm hover:shadow-lg transition-shadow duration-200 p-7 flex flex-col items-start min-h-[150px]"
          >
            <div className="mb-4">{f.icon}</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">{f.title}</h2>
            <Link
              href={f.link} // Changed 'to' to 'href'
              className="mt-auto px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors w-full shadow-sm text-center"
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
