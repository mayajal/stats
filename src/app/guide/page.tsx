
import { BookOpen, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function GuidePage() {
  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-screen">
      <header className="mb-8 text-center w-full flex flex-col items-center">
         <div className="w-full flex justify-start">
             <Link href="/" passHref>
                <Button variant="outline" size="sm"> &larr; Home</Button>
            </Link>
        </div>
        <div className="flex items-center justify-center my-4">
          <BookOpen className="h-10 w-10 text-primary mr-3" />
          <h1 className="font-headline text-4xl font-bold tracking-tight">Statistical Guide</h1>
        </div>
        <p className="text-muted-foreground text-lg">Your journey into statistical understanding starts here.</p>
      </header>

      <main className="w-full max-w-4xl">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Content Coming Soon!</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
                <p className="text-muted-foreground mb-6">
                    We're currently developing a comprehensive guide to help you understand statistical concepts and choose the best analysis methods.
                    Please check back later!
                </p>
                <BarChart3 className="mx-auto h-16 w-16 text-primary/30 animate-pulse" />
            </CardContent>
        </Card>
      </main>

       <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} StatViz. All rights reserved.</p>
      </footer>
    </div>
  );
}
