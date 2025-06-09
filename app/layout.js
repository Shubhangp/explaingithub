// Look for and fix any of these issues:
// 1. Remove any infinite loops or excessive state updates
// 2. Move heavy computations outside the component
// 3. Add proper dependency arrays to useEffect hooks
// 4. Break down complex logic into smaller components

// For example, if you have something like:
useEffect(() => {
  // Some code that might cause infinite updates
  setSomeState(newValue);
}, []); // Make sure dependency arrays are properly defined 

// Instead of:
useEffect(() => {
  const fetchData = async () => {
    const result = await fetch('/api/some-heavy-data');
    const data = await result.json();
    setData(data);
  };
  fetchData();
}, []);

// Consider using Next.js data fetching patterns:
// 1. For server components:
const data = await fetchData(); // Using top-level await

// 2. Or for client components, implement proper loading states:
useEffect(() => {
  setLoading(true);
  const fetchData = async () => {
    try {
      const result = await fetch('/api/data');
      const data = await result.json();
      setData(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []); 

// Instead of having all components in the layout
return (
  <html lang="en">
    <body>
      {/* Move these to separate components if they're complex */}
      <Header />
      <Sidebar />
      <main>{children}</main>
      <Footer />
    </body>
  </html>
); 

// Be careful with imports like these:
import HeavyLibrary from 'heavy-library'; // This might cause performance issues

// Consider dynamic imports for heavy libraries:
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false // If not needed for server-side rendering
}); 