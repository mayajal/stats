
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Send, User, Bot, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getStatisticalGuidance } from '@/app/actions';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

const initialBotMessage: Message = {
  role: 'bot',
  content: `Hello! I'm here to help you choose the right statistical analysis. To get started, please tell me a bit about your research. For example:

- What kind of field experiment did you conduct? (e.g., testing pesticide efficacy, comparing hybrid performance)
- What type of data are you analyzing? (e.g., experimental observations, survey results)
- What is your primary goal? (e.g., comparing group means, testing a hypothesis)
- Are you considering a specific test? (e.g., ANOVA, t-test, regression)`
};

export default function GuidePage() {
  const [messages, setMessages] = useState<Message[]>([initialBotMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const botResponse = await getStatisticalGuidance({ question: input });
      const botMessage: Message = { role: 'bot', content: botResponse.answer };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = { role: 'bot', content: 'Sorry, I encountered an error. Please try again.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  return (
    <div className="container mx-auto py-4 px-4 flex flex-col items-center min-h-screen">
      
          <div className="flex items-center justify-center my-2">
          <BookOpen className="h-6 w-10 text-primary mr-3" />
          <h1 className="mt-2 font-headline text-3xl font-bold tracking-tight">Statistical Guide</h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl">Ask me anything about which statistical test to use!</p>
        <p className="text-muted-foreground text-lg max-w-2xl">For example: "When should I use ANOVA?"</p>
        <p className="text-muted-foreground text-lg max-w-2xl mb-4"> </p>
      <main className="w-full max-w-2xl flex-grow flex flex-col">
        <Card className="flex-grow flex flex-col">
          <CardHeader>
            <CardTitle className="font-headline text-lg">Conversation</CardTitle>
            <CardDescription>Ask the AI assistant for guidance.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col">
            <ScrollArea className="flex-grow h-[400px] w-full pr-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                    {message.role === 'bot' && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback><Bot size={20} /></AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`rounded-lg px-3 py-2 max-w-sm ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <p className="text-sm" dangerouslySetInnerHTML={{ __html: message.content.replace(/\\n/g, '<br />') }}/>
                    </div>
                    {message.role === 'user' && (
                       <Avatar className="h-8 w-8">
                        <AvatarFallback><User size={20} /></AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback><Bot size={20}/></AvatarFallback>
                        </Avatar>
                         <div className="rounded-lg px-3 py-2 bg-muted flex items-center space-x-2">
                           <Loader2 className="h-4 w-4 animate-spin" />
                           <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                    </div>
                )}
              </div>
            </ScrollArea>
            <form onSubmit={handleSendMessage} className="mt-4 flex items-center gap-2 border-t pt-4">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question here..."
                disabled={isLoading}
                className="flex-grow"
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>


    </div>
  );
}
