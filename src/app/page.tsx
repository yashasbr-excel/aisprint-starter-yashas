'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		// Redirect to dashboard if user is already logged in
		if (!loading && user) {
			router.push('/dashboard');
		}
	}, [user, loading, router]);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center space-y-4">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
					<p className="text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	// If user is logged in, show loading while redirecting
	if (user) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center space-y-4">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
					<p className="text-gray-600">Redirecting to dashboard...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
			{/* Hero Section */}
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
				<div className="text-center space-y-8">
					<h1 className="text-5xl md:text-6xl font-bold text-gray-900">
						Welcome to <span className="text-blue-600">QuizMaker</span>
					</h1>
					<p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
						Create engaging multiple choice quizzes for your students with ease.
						Build, manage, and share MCQ tests aligned with educational standards.
					</p>

					<div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
						<Link href="/signup">
							<Button size="lg" className="text-lg px-8 py-6 w-full sm:w-auto">
								Get Started
							</Button>
						</Link>
						<Link href="/login">
							<Button size="lg" variant="outline" className="text-lg px-8 py-6 w-full sm:w-auto">
								Log In
							</Button>
						</Link>
					</div>
				</div>

				{/* Features Section */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24">
					<Card className="hover:shadow-lg transition-shadow">
						<CardHeader>
							<CardTitle className="text-2xl">📝 Easy Quiz Creation</CardTitle>
						</CardHeader>
						<CardContent>
							<CardDescription className="text-base">
								Create multiple choice questions with an intuitive interface.
								Add questions, options, and correct answers in seconds.
							</CardDescription>
						</CardContent>
					</Card>

					<Card className="hover:shadow-lg transition-shadow">
						<CardHeader>
							<CardTitle className="text-2xl">📚 Standards Aligned</CardTitle>
						</CardHeader>
						<CardContent>
							<CardDescription className="text-base">
								Align your quizzes with state standards like TEKS with AI assistance.
								Ensure your assessments meet educational requirements.
							</CardDescription>
						</CardContent>
					</Card>

					<Card className="hover:shadow-lg transition-shadow">
						<CardHeader>
							<CardTitle className="text-2xl">🎯 Manage & Share</CardTitle>
						</CardHeader>
						<CardContent>
							<CardDescription className="text-base">
								Organize your quiz library, preview student views, and share
								assessments with your classes effortlessly.
							</CardDescription>
						</CardContent>
					</Card>
				</div>

				{/* CTA Section */}
				<div className="mt-24 text-center">
					<Card className="max-w-2xl mx-auto bg-blue-50 border-blue-200">
						<CardHeader>
							<CardTitle className="text-3xl">Ready to get started?</CardTitle>
							<CardDescription className="text-lg">
								Join QuizMaker today and start creating amazing quizzes for your students.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Link href="/signup">
								<Button size="lg" className="text-lg px-8 py-6">
									Create Your Free Account
								</Button>
							</Link>
						</CardContent>
					</Card>
				</div>
			</main>

			{/* Footer */}
			<footer className="mt-24 border-t bg-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<div className="text-center text-gray-600">
						<p>&copy; {new Date().getFullYear()} QuizMaker. All rights reserved.</p>
					</div>
				</div>
			</footer>
		</div>
	);
}
