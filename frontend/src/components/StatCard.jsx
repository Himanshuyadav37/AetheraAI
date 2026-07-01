import "./StatCard.css";
function StatCard({
  title,
  value,
  icon
}) {

  return (

    <div className="stat-card">

      <div className="stat-top">

        <div className="stat-icon">
          {icon}
        </div>

      </div>

      <div className="stat-content">

        <p>
          {title}
        </p>

        <h2>
          {value}
        </h2>

      </div>

    </div>

  );

}

export default StatCard;