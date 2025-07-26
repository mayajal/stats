
'use client';

import { BarChart3, BookOpen, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-background to-secondary/30">
      <header className="mb-10 text-center">
        <div className="flex items-center justify-center mb-2">
          <BarChart3 className="h-14 w-14 text-primary mr-3 animate-pulse" />
          <h1 className="font-headline text-5xl md:text-6xl font-bold tracking-tight">StatViz</h1>
        </div>
        <p className="text-muted-foreground text-lg md:text-xl">Intuitive Statistical Analysis & Visualization</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center">
                <BookOpen className="mr-3 h-7 w-7 text-primary" />
                Statistical Guide
            </CardTitle>
            <CardDescription>
                New to statistics? Our guide explains key concepts and helps you choose the right analysis for your data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/guide" passHref>
              <Button variant="outline" className="w-full">
                Start Learning
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-primary/50 ring-2 ring-primary/20">
          <CardHeader>
             <CardTitle className="font-headline text-2xl flex items-center">
                <Compass className="mr-3 h-7 w-7 text-primary" />
                Statistical Analysis
            </CardTitle>
            <CardDescription>
                Ready to analyze? Upload your data, define your variables, and perform statistical tests with our guided tool.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Link href="/analysis" passHref>
              <Button className="w-full">
                Launch Analysis Tool
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>

      <footer className="absolute bottom-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} StatViz. All rights reserved.</p>
        <p className="mt-1">Powered by Next.js, ShadCN/UI, and Genkit AI.</p>
      </footer>
    </div>
  );
}
