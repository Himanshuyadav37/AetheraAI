function GenericOutputPanel({

  title,

  result

}) {

  if (!result) return null;

  return (

    <div className="output-card">

      <h2>

        {title}

      </h2>

      <div className="debug-box">

        {

          result.message ||

          result.output ||

          result.response ||

          "No Output"

        }

      </div>

    </div>

  );

}

export default GenericOutputPanel;