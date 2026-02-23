import SubscriptionGuard from "../components/SubscriptionGuard";
import Navbar from "../components/Navbar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SubscriptionGuard>
      <Navbar />
      {children}
    </SubscriptionGuard>
  );
}