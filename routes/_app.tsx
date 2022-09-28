// support jsx on deno deploy
/** @jsxImportSource https://esm.sh/react@18.2.0 */

export default function App({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  );
}
