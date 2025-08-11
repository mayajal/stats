import type { Metadata } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import './globals.css'
import Link from "next/link";
import { FaHome, FaBook } from "react-icons/fa";

const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '700'] })

export const metadata: Metadata = {
  title: 'VITA - AI-Powered Statistical Guide & Analysis Tool',
  description: 'Get expert help choosing the right statistical methods for your agricultural research',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-MC16GF6L4C"></script>
        <script>
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-MC16GF6L4C');
          `}
        </script>
      </head>
      <body className={`${ibmPlexSans.className} flex flex-col min-h-screen`}>
        <header className="sticky top-0 z-50 bg-white text-left p-4 text-2xl font-bold flex justify-between items-center">
          <Link href="/" className="text-gray-900 hover:text-blue-900">VITA</Link>
          <nav className="flex space-x-4 text-lg">
            <Link href="/" className="flex items-center space-x-2 text-gray-700 hover:text-blue-600">
              <FaHome />
              <span>Home</span>
            </Link>
            <Link href="/guide" className="flex items-center space-x-2 text-gray-700 hover:text-blue-600">
              <FaBook />
              <span>AI-Guide</span>
            </Link>
          </nav>
        </header>
        <hr className="border-b border-gray-200 mb-4" />
        <main className="flex-grow">{children}</main>
        <hr className="border-t border-gray-200 my-4" />
        <footer className="text-center p-4 text-sm text-gray-500">
          &copy; Chloropy 2025 <a href="mailto:contact@chloropy.com" className="text-blue-600 hover:underline">Feedback</a>  <a href="https://www.chloropy.com/vita/data-privacy" className="text-blue-600 hover:underline">Data Privacy</a>
        </footer>
      </body>
    </html>
  )
} 