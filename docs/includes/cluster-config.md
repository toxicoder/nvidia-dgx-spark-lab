> **Interactive docs**: Use the cluster variables panel below. Edit the values — every code example on this page (and other pages that include this panel) will update instantly and the Copy buttons will use the live values.

<div class="cluster-config admonition info" data-vars="SPARK0_IP,NAMESPACE,DASHBOARD_PORT">
  <p><strong>Live cluster variables</strong> (edits propagate to all examples + copies on this page)</p>
  <div>
    <!-- Defaults must match the primary profile button (1-node / localhost). -->
    <label>SPARK0_IP: <input data-var="SPARK0_IP" value="localhost" placeholder="spark0-ip"></label>
    <label>NAMESPACE: <input data-var="NAMESPACE" value="ai-inference"></label>
    <label>PORT example: <input data-var="DASHBOARD_PORT" value="32082"></label>
  </div>
  <div>
    <button type="button" data-profile="1node" class="md-button md-button--primary">1-node / localhost profile</button>
    <button type="button" data-profile="2node" class="md-button">2-node typical profile</button>
    <small>(live updates + copy buttons respect current values)</small>
  </div>
</div>
