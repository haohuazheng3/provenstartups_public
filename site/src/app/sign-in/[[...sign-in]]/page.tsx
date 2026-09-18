import { SignIn } from "@clerk/nextjs";
import ScrollToTop from "@/components/ScrollToTop";

export const metadata = {
  title: "Sign in",
  robots: { index: false },
};

// 注册与登录合一:用户只输入邮箱 → 收验证码 → 进站。
// Clerk combined flow(withSignUp):未注册自动创建账号,已注册直接发码。
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const requested = (await searchParams).redirect_url;
  const redirectUrl = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  return (
    <div className="flex justify-center px-4 pt-16 pb-8">
      <ScrollToTop />
      <SignIn
        withSignUp
        forceRedirectUrl={redirectUrl}
        signUpForceRedirectUrl={redirectUrl}
      />
    </div>
  );
}
