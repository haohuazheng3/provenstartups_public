import { SignIn } from "@clerk/nextjs";
import ScrollToTop from "@/components/ScrollToTop";

export const metadata = {
  title: "Sign in",
  robots: { index: false },
};

// 注册与登录合一:用户只输入邮箱 → 收验证码 → 进站。
// Clerk combined flow(withSignUp):未注册自动创建账号,已注册直接发码。
// translate="no":Clerk 组件内部的 OTP 输入框和状态机经不起浏览器自动翻译改写 DOM。
// 页面其余部分照常可翻译,只有这个框保持英文 —— 它就一行邮箱、一个六位码。
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const requested = (await searchParams).redirect_url;
  const redirectUrl = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  return (
    <div className="flex justify-center px-4 pt-16 pb-8" translate="no">
      <ScrollToTop />
      <SignIn
        withSignUp
        forceRedirectUrl={redirectUrl}
        signUpForceRedirectUrl={redirectUrl}
      />
    </div>
  );
}
