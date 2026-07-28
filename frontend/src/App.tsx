import React from 'react';
import DocumentForm from './components/DocumentForm';

// The previous entry point (pages/index.tsx, a Next.js convention that
// doesn't apply to this Vite project) just embedded the raw JSON API
// response in an <iframe> and never rendered the actual registration form.
const App: React.FC = () => {
  return <DocumentForm />;
};

export default App;
