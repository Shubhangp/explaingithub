'use client'

import { useSearchParams } from 'next/navigation'
import RepoViewer from '@/app/components/RepoViewer'

export default function RepoPage({ params }: { params: { owner: string; repo: string } }) {
  // Get provider from URL query parameters
  const searchParams = useSearchParams()
  const provider = searchParams.get('provider') || 'github'
  
  return (
    <div className="h-screen">
      {/* Main content */}
      <div className="w-full">
        <RepoViewer owner={params.owner} repo={params.repo} provider={provider as 'github' | 'gitlab'} />
      </div>
    </div>
  )
} 