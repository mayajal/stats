
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">
            Welcome to StatViz
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Your AI-Powered Statistical Guide
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-6">
            Get expert help choosing the right statistical methods for your agricultural research. Ask questions and get clear, conversational answers based on our curated knowledge base.
          </p>
          <Link href="/guide" passHref>
            <Button size="lg">
              Start Chatting <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} StatViz. All rights reserved.</p>
      </footer>
    </div>
  );
}
