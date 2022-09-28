/** @jsx React.createElement */
import * as React from 'react';

export default function App({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  );
}
