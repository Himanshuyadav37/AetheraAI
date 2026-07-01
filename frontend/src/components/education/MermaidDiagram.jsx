import { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({

    startOnLoad: false,

    securityLevel: "loose",

    theme: "dark",

    flowchart: {

        curve: "basis",

    },

});

function MermaidDiagram({

    chart,

}) {

    const ref = useRef(null);

    useEffect(() => {

        async function renderDiagram() {

            if (

                !chart ||

                !ref.current

            ) return;

            try {

                const id =

                    "diagram-" +

                    Math.random()

                        .toString(36)

                        .substring(2, 9);

                const {

                    svg,

                } = await mermaid.render(

                    id,

                    chart

                );

                ref.current.innerHTML = svg;

            }

            catch (err) {

                console.error(

                    err

                );

                ref.current.innerHTML = `

<pre>

${chart}

</pre>

`;

            }

        }

        renderDiagram();

    }, [chart]);

    return (

        <div

            className="mermaid-wrapper"

            ref={ref}

        />

    );

}

export default MermaidDiagram;