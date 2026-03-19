export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#141414,transparent)] opacity-50" />
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
