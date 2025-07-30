
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BarChart3, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Welcome to StatViz
          </h1>
          <p className="text-lg text-muted-foreground">
            Your AI-Powered Statistical Guide & Analysis Tool
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* AI Guide Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
                <MessageSquare className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl font-bold">
                AI Statistical Guide
              </CardTitle>
              <CardDescription className="text-base">
                Get expert help choosing the right statistical methods
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="mb-6 text-sm text-muted-foreground">
                Ask questions and get clear, conversational answers based on our curated knowledge base for agricultural research.
              </p>
              <Link href="/guide" passHref>
                <Button size="lg" className="w-full">
                  Start Chatting <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Statistical Analysis Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit">
                <BarChart3 className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl font-bold">
                Statistical Analysis
              </CardTitle>
              <CardDescription className="text-base">
                Upload your data and get descriptive statistics
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="mb-6 text-sm text-muted-foreground">
                Upload Excel files and perform descriptive statistical analysis including mean, median, mode, variance, and standard deviation.
              </p>
              <Link href="/analysis" passHref>
                <Button size="lg" className="w-full">
                  Start Analysis <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} StatViz. All rights reserved.</p>
      </footer>
    </div>
  );
}
