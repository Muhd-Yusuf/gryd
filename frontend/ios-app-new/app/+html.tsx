import { ScrollViewStyleReset } from 'expo-router/html';

// This file sets up the HTML document for web builds.
// Sets the body background to dark so no white flash on load.
export default function Root({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, shrink-to-fit=no"
                />
                <ScrollViewStyleReset />
                <style dangerouslySetInnerHTML={{
                    __html: `
                        html, body, #root {
                            height: 100%;
                            margin: 0;
                            padding: 0;
                        }
                        body {
                            background-color: #000000;
                            overflow: hidden;
                        }
                        #root {
                            display: flex;
                            flex: 1;
                        }
                    `
                }} />
            </head>
            <body>{children}</body>
        </html>
    );
}
