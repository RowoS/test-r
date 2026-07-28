import Image from "next/image";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { login } from "@/lib/auth-actions";

export default function LoginPage() {
  return (
    <main>
      <div className="flex flex-col items-center flex-1 justify-center h-screen w-screen bg-[#FAFAFA]">
        {/* Form Here */}
        <form className="flex flex-col justify-center gap-8 py-8 pr-10 pl-8 w-fit h-fit bg-white items-center border border-[#F2F2F2] rounded-lg">
          <div className="flex flex-col w-fit h-fit gap-4">
            <div className="flex flex-row gap-1.5 justify-center">
              {/* Brand Logo */}
              <div className="flex">
                <Image
                  src="/logo-icon-dark.svg"
                  alt="Brand Logo"
                  width={27}
                  height={28}
                  className="w-full h-auto"
                />
              </div>
              <div className="flex flex-row items-center text-lg">
                <p className="font-redhat text-[#26343A] font-black ">Sci</p>
                <p className="bg-linear-to-r from-[#008AAC] to-[#71BED1] bg-clip-text text-transparent">.</p>
                <p className="font-redhat text-[#26343A] font-black ">Part</p>
              </div>
            </div>
            <div className="font-redhat gap-0 flex flex-col items-center">
              <p className="font-black text-xl text-[#26343A]">Welcome Back</p>
              <p className="font-normal text-xs text-[#26343A]">DOST8 IT Support Portal &mdash; signin to continue</p>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <Input
              type="email"
              name="email" 
              placeholder="Email Address"
              required 
              className="h-12 w-80 bg-[#FAFAFA] border border-[#E2E2E2]"
            />
            <Input 
              type="password" 
              name="password" 
              placeholder="Password"
              required 
              className="h-12 w-80 bg-[#FAFAFA] border border-[#E2E2E2]" 
            />
          </div>
          <Button type="submit" variant="default" formAction={login} className="w-full h-12 bg-linear-to-r from-[#008AAC] to-[#71BED1] font-sans font-bold">Login</Button>
        </form>
      </div>
    </main>
  );
}