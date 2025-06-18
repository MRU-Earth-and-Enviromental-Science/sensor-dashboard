"use client"

export function Footer() {
    return (
        <footer className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-center">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        <a
                            href="https://www.mtroyal.ca/ProgramsCourses/FacultiesSchoolsCentres/ScienceTechnology/Departments/EarthEnvironmentalSciences/index.htm"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 no-underline transition-colors"
                        >
                            Mount Royal University © 2025
                        </a>
                    </p>
                    <span className="hidden sm:inline text-muted-foreground">•</span>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        🛠 developed by shivam walia, mechatronics @uwaterloo '29{" "}
                        <a
                            href="https://www.linkedin.com/in/shivam-walia-395877251/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 no-underline transition-colors"
                        >
                            [linkedIn]
                        </a>{" "}
                        <a
                            href="https://github.com/shivam-2507"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 no-underline transition-colors"
                        >
                            [github]
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    )
}
