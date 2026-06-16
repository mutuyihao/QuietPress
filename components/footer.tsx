import Link from "next/link";
import { Github, Twitter, Linkedin, Instagram } from "lucide-react";
// import { NewsletterTrigger } from '@/components/newsletter-form'

interface FooterProps {
  siteName: string;
  socialLinks?: Record<string, string>;
}

export function Footer({ siteName, socialLinks = {} }: FooterProps) {
  const platforms = [
    { name: "github", icon: Github, label: "GitHub" },
    { name: "twitter", icon: Twitter, label: "Twitter" },
    { name: "linkedin", icon: Linkedin, label: "LinkedIn" },
    { name: "instagram", icon: Instagram, label: "Instagram" },
  ];

  const activeLinks = platforms.filter((p) => socialLinks[p.name]);

  return (
    <footer className="mt-auto">
      <div className="max-w-[640px] mx-auto px-6">
        <div className="animate-line-grow h-px bg-border/60" />
        <div className="py-12 sm:py-16 flex flex-col items-center gap-6 text-center">
          {activeLinks.length > 0 && (
            <div className="flex items-center gap-5">
              {activeLinks.map(({ name, icon: Icon, label }) => (
                <a
                  key={name}
                  href={socialLinks[name]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-editorial hover:scale-105 transform duration-200"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
          <div className="flex flex-col items-center gap-2">
            <p className="text-[13px] tracking-wide text-muted-foreground">
              &copy; {new Date().getFullYear()} {siteName}
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/rss.xml"
                className="nav-link text-[12px] tracking-widest uppercase text-muted-foreground transition-editorial hover:text-foreground"
              >
                RSS
              </Link>
              {/*
                Newsletter is temporarily hidden until outbound email sending,
                confirmation, and unsubscribe flows are implemented.
                <NewsletterTrigger />
              */}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
