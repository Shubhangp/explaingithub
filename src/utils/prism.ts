import Prism from 'prismjs'

// Import base CSS
import 'prismjs/themes/prism.css'

// Function to load Prism languages dynamically
export async function loadPrismLanguages() {
  // Only load languages on client side
  if (typeof window === 'undefined') return

  try {
    // Load core languages
    await Promise.allSettled([
      import('prismjs/components/prism-python'),
      import('prismjs/components/prism-javascript'),
      import('prismjs/components/prism-typescript'),
      import('prismjs/components/prism-jsx'),
      import('prismjs/components/prism-tsx'),
      import('prismjs/components/prism-css'),
      import('prismjs/components/prism-json'),
      import('prismjs/components/prism-markdown'),
      import('prismjs/components/prism-bash'),
      import('prismjs/components/prism-yaml'),
      import('prismjs/components/prism-go'),
      import('prismjs/components/prism-rust'),
      import('prismjs/components/prism-java'),
      import('prismjs/components/prism-c'),
      import('prismjs/components/prism-cpp'),
      import('prismjs/components/prism-sql'),
      import('prismjs/components/prism-markup'),
    ])
  } catch (error) {
    console.error('Error loading Prism languages:', error)
  }
}

// Add a flag to track if languages are loaded
let languagesLoaded = false

// Export a function to check if languages are loaded
export function arePrismLanguagesLoaded() {
  return languagesLoaded
}

// Modify the loadPrismLanguages function to set the flag
export async function initPrismLanguages() {
  if (typeof window === 'undefined') return

  if (!languagesLoaded) {
    await loadPrismLanguages()
    languagesLoaded = true
  }
}

export default Prism 