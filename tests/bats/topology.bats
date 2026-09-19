#!/usr/bin/env bats
#
# Hermetic tests for the lab topology model (ansible/inventory/lab.yaml) and the
# generated Ansible artifacts (hosts.ini, fabric group vars, netplan, cloud-init).

load 'test_helper'

setup() {
  export REPO_ROOT="$(bats_canonical_repo_root)"
  # shellcheck source=paths.sh disable=SC1091
  source "${REPO_ROOT}/scripts/lib/paths.sh"
  # shellcheck source=common.sh disable=SC1091
  source "${REPO_ROOT}/scripts/lib/common.sh"
  # shellcheck source=topology.sh disable=SC1091
  source "${REPO_ROOT}/scripts/lib/topology.sh"
  TOP_PY="${REPO_ROOT}/scripts/lib/py/lab_topology.py"
  FIX="$BATS_TMPDIR/lab-fix"
  OUT="$BATS_TMPDIR/lab-out"
  rm -rf "$FIX" "$OUT"
  mkdir -p "$FIX" "$OUT"
}

# @function fixture_one_node
# Write a 1-node (fabric none) lab.yaml fixture.
fixture_one_node() {
  cat > "$FIX/one.yaml" <<'YAML'
lab:
  management:
    subnet: 10.0.0.0/24
  ansible_user: ubuntu
  fabric: none
  nodes:
    - name: spark0
      ip: 10.0.0.10
      role: orchestrator
YAML
}

# @function fixture_pair
# Write a 2-node (fabric pair) lab.yaml fixture.
fixture_pair() {
  cat > "$FIX/pair.yaml" <<'YAML'
lab:
  management:
    subnet: 10.0.0.0/24
  ansible_user: ubuntu
  fabric: pair
  nodes:
    - name: spark0
      ip: 10.0.0.10
      role: orchestrator
      hs_ifs:
        - enp1s0f0np0
        - enp1s0f1np1
    - name: spark1
      ip: 10.0.0.11
      hs_ifs:
        - enp1s0f0np0
        - enp1s0f1np1
YAML
}

# @function fixture_ring
# Write a 3-node (fabric ring) lab.yaml fixture.
fixture_ring() {
  cat > "$FIX/ring.yaml" <<'YAML'
lab:
  management:
    subnet: 10.0.0.0/24
  ansible_user: ubuntu
  fabric: ring
  nodes:
    - name: spark0
      ip: 10.0.0.10
      role: orchestrator
      hs_ifs:
        - enp1s0f0np0
        - enp1s0f1np1
    - name: spark1
      ip: 10.0.0.11
      hs_ifs:
        - enp1s0f0np0
        - enp1s0f1np1
    - name: spark2
      ip: 10.0.0.12
      hs_ifs:
        - enp1s0f0np0
        - enp1s0f1np1
YAML
}

# @function fixture_switch
# Write an N-node (fabric switch) fixture; $1 = node count (4 or 5).
fixture_switch() {
  local n="$1"
  cat > "$FIX/switch-${n}.yaml" <<'YAML'
lab:
  management:
    subnet: 10.0.0.0/24
  ansible_user: ubuntu
  fabric: switch
  switch:
    brand: mikrotik
    model: CRS804-4DDQ-hRM
    host: 10.0.0.2
    user: admin
    port_map:
      - node: spark0
        port: sfpplus1
      - node: spark1
        port: sfpplus2
      - node: spark2
        port: sfpplus3
      - node: spark3
        port: sfpplus4a
      - node: spark4
        port: sfpplus4b
  nodes:
    - name: spark0
      ip: 10.0.0.10
      role: orchestrator
      hs_ifs:
        - enp1s0f0np0
        - enp1s0f1np1
    - name: spark1
      ip: 10.0.0.11
      hs_ifs:
        - enp1s0f0np0
        - enp1s0f1np1
    - name: spark2
      ip: 10.0.0.12
      hs_ifs:
        - enp1s0f0np0
        - enp1s0f1np1
    - name: spark3
      ip: 10.0.0.13
      hs_ifs:
        - enp1s0f0np0
        - enp1s0f1np1
    - name: spark4
      ip: 10.0.0.14
      hs_ifs:
        - enp1s0f0np0
        - enp1s0f1np1
YAML
  if [[ "$n" -eq 4 ]]; then
    # 4 nodes use the four full QSFP-DD ports (no breakout lanes).
    python3 - "$FIX/switch-${n}.yaml" <<'PY'
import sys, yaml
p = sys.argv[1]
cfg = yaml.safe_load(open(p))
cfg["lab"]["nodes"] = cfg["lab"]["nodes"][:4]
cfg["lab"]["switch"]["port_map"] = [
    {"node": "spark0", "port": "sfpplus1"},
    {"node": "spark1", "port": "sfpplus2"},
    {"node": "spark2", "port": "sfpplus3"},
    {"node": "spark3", "port": "sfpplus4"},
]
open(p, "w").write(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
PY
  fi
}

@test "validate accepts the committed reference lab.yaml (5-node switch)" {
  run python3 "$TOP_PY" validate "${REPO_ROOT}/ansible/inventory/lab.yaml"
  [ "$status" -eq 0 ]
}

@test "validate accepts one-node none fabric" {
  fixture_one_node
  run python3 "$TOP_PY" validate "$FIX/one.yaml"
  [ "$status" -eq 0 ]
}

@test "validate accepts two-node pair" {
  fixture_pair
  run python3 "$TOP_PY" validate "$FIX/pair.yaml"
  [ "$status" -eq 0 ]
}

@test "validate accepts three-node ring" {
  fixture_ring
  run python3 "$TOP_PY" validate "$FIX/ring.yaml"
  [ "$status" -eq 0 ]
}

@test "validate accepts four-node switch" {
  fixture_switch 4
  run python3 "$TOP_PY" validate "$FIX/switch-4.yaml"
  [ "$status" -eq 0 ]
}

@test "validate rejects six nodes" {
  fixture_switch 5
  python3 - "$FIX/switch-5.yaml" <<'PY'
import sys, yaml
p = sys.argv[1]
cfg = yaml.safe_load(open(p))
node = dict(cfg["lab"]["nodes"][0])
node.update({"name": "spark6", "ip": "10.0.0.16", "role": None})
del node["role"]
cfg["lab"]["nodes"].append(node)
open(p, "w").write(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
PY
  run python3 "$TOP_PY" validate "$FIX/switch-5.yaml"
  [ "$status" -ne 0 ]
}

@test "validate rejects two orchestrators" {
  fixture_pair
  python3 - "$FIX/pair.yaml" <<'PY'
import sys, yaml
p = sys.argv[1]
cfg = yaml.safe_load(open(p))
cfg["lab"]["nodes"][1]["role"] = "orchestrator"
open(p, "w").write(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
PY
  run python3 "$TOP_PY" validate "$FIX/pair.yaml"
  [ "$status" -ne 0 ]
}

@test "validate rejects missing orchestrator" {
  fixture_pair
  python3 - "$FIX/pair.yaml" <<'PY'
import sys, yaml
p = sys.argv[1]
cfg = yaml.safe_load(open(p))
del cfg["lab"]["nodes"][0]["role"]
open(p, "w").write(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
PY
  run python3 "$TOP_PY" validate "$FIX/pair.yaml"
  [ "$status" -ne 0 ]
}

@test "validate rejects fabric and node count mismatch (pair with 3 nodes)" {
  fixture_ring
  python3 - "$FIX/ring.yaml" <<'PY'
import sys, yaml
p = sys.argv[1]
cfg = yaml.safe_load(open(p))
cfg["lab"]["fabric"] = "pair"
open(p, "w").write(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
PY
  run python3 "$TOP_PY" validate "$FIX/ring.yaml"
  [ "$status" -ne 0 ]
}

@test "validate rejects switch fabric without port map" {
  fixture_switch 4
  python3 - "$FIX/switch-4.yaml" <<'PY'
import sys, yaml
p = sys.argv[1]
cfg = yaml.safe_load(open(p))
del cfg["lab"]["switch"]["port_map"]
open(p, "w").write(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
PY
  run python3 "$TOP_PY" validate "$FIX/switch-4.yaml"
  [ "$status" -ne 0 ]
}

@test "validate rejects a breakout lane missing its sibling" {
  fixture_switch 4
  python3 - "$FIX/switch-4.yaml" <<'PY'
import sys, yaml
p = sys.argv[1]
cfg = yaml.safe_load(open(p))
# 4 nodes but one port is a breakout lane without its sibling — impossible wiring.
cfg["lab"]["switch"]["port_map"][3] = {"node": "spark3", "port": "sfpplus4a"}
open(p, "w").write(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
PY
  run python3 "$TOP_PY" validate "$FIX/switch-4.yaml"
  [ "$status" -ne 0 ]
}

@test "validate rejects duplicate management IPs" {
  fixture_pair
  python3 - "$FIX/pair.yaml" <<'PY'
import sys, yaml
p = sys.argv[1]
cfg = yaml.safe_load(open(p))
cfg["lab"]["nodes"][1]["ip"] = "10.0.0.10"
open(p, "w").write(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
PY
  run python3 "$TOP_PY" validate "$FIX/pair.yaml"
  [ "$status" -ne 0 ]
}

@test "facts reports fabric, orchestrator, and node count" {
  fixture_switch 5
  run python3 "$TOP_PY" facts "$FIX/switch-5.yaml"
  [ "$status" -eq 0 ]
  [[ "$output" == *$'fabric=switch'* ]]
  [[ "$output" == *$'orchestrator=spark0'* ]]
  [[ "$output" == *$'node_count=5'* ]]
  [[ "$output" == *$'switch_host=10.0.0.2'* ]]
}

@test "wizard-vars pre-fills defaults from the reference 5-node switch lab" {
  run python3 "$TOP_PY" wizard-vars "${REPO_ROOT}/ansible/inventory/lab.yaml"
  [ "$status" -eq 0 ]
  [[ "$output" == *$'fabric=switch'* ]]
  [[ "$output" == *$'node_count=5'* ]]
  [[ "$output" == *$'orchestrator=spark0'* ]]
  [[ "$output" == *$'node_names=spark0,spark1,spark2,spark3,spark4'* ]]
  [[ "$output" == *$'node_ips=10.0.0.10,10.0.0.11,10.0.0.12,10.0.0.13,10.0.0.14'* ]]
  [[ "$output" == *$'mgmt_subnet=10.0.0.0/24'* ]]
  [[ "$output" == *$'ansible_user=ubuntu'* ]]
  [[ "$output" == *$'switch_model=CRS804-4DDQ-hRM'* ]]
  [[ "$output" == *$'switch_host=10.0.0.2'* ]]
  [[ "$output" == *$'switch_user=admin'* ]]
  [[ "$output" == *$'port_map=spark0:sfpplus1,spark1:sfpplus2,spark2:sfpplus3,spark3:sfpplus4a,spark4:sfpplus4b'* ]]
}

@test "wizard-vars pre-fills defaults from a 2-node pair lab" {
  fixture_pair
  run python3 "$TOP_PY" wizard-vars "$FIX/pair.yaml"
  [ "$status" -eq 0 ]
  [[ "$output" == *$'fabric=pair'* ]]
  [[ "$output" == *$'node_count=2'* ]]
  [[ "$output" == *$'orchestrator=spark0'* ]]
  [[ "$output" == *$'node_names=spark0,spark1'* ]]
  # No switch block: empty port_map.
  [[ "$output" == *$'port_map='* ]]
  [[ ! "$output" == *$'port_map=s'* ]]
}

@test "wizard-vars rejects an invalid lab file" {
  fixture_pair
  python3 - "$FIX/pair.yaml" <<'PY'
import sys, yaml
p = sys.argv[1]
cfg = yaml.safe_load(open(p))
cfg["lab"]["nodes"][1]["ip"] = cfg["lab"]["nodes"][0]["ip"]
open(p, "w").write(yaml.dump(cfg, default_flow_style=False, sort_keys=False))
PY
  run python3 "$TOP_PY" wizard-vars "$FIX/pair.yaml"
  [ "$status" -ne 0 ]
}

@test "render writes hosts.ini with movable k3s_server group" {
  fixture_ring
  run python3 "$TOP_PY" render "$FIX/ring.yaml" --out "$OUT"
  [ "$status" -eq 0 ]
  local ini="$OUT/ansible/inventory/hosts.ini"
  [ -f "$ini" ]
  # k3s_server holds only the orchestrator.
  [[ "$(awk '/^\[k3s_server\]/{f=1;next}/^\[/{f=0}f' "$ini")" == "spark0" ]]
  # k3s_agent holds the rest.
  [[ "$(awk '/^\[k3s_agent\]/{f=1;next}/^\[/{f=0}f' "$ini")" == *"spark1"* ]]
  [[ "$(awk '/^\[k3s_agent\]/{f=1;next}/^\[/{f=0}f' "$ini")" == *"spark2"* ]]
  # k3s_cluster holds the host lines for every node.
  for n in spark0 spark1 spark2; do
    [[ "$(awk '/^\[k3s_cluster\]/{f=1;next}/^\[/{f=0}f' "$ini")" == *"$n"* ]]
  done
  # Host lines carry ansible_host + ansible_user.
  grep -q 'spark1 ansible_host=10.0.0.11 ansible_user=ubuntu' "$ini"
}

@test "render pair netplan uses two /24 subnets with MTU 9000" {
  fixture_pair
  python3 "$TOP_PY" render "$FIX/pair.yaml" --out "$OUT"
  local n0="$OUT/ansible/files/generated/netplan/spark0-99-highspeed.yaml"
  local n1="$OUT/ansible/files/generated/netplan/spark1-99-highspeed.yaml"
  [ -f "$n0" ] && [ -f "$n1" ]
  grep -q '192.168.100.1/24' "$n0"
  grep -q '192.168.101.1/24' "$n0"
  grep -q '192.168.100.2/24' "$n1"
  grep -q '192.168.101.2/24' "$n1"
  grep -q 'mtu: 9000' "$n0"
  grep -q 'mtu: 9000' "$n1"
}

@test "render ring netplan creates six unique /24 subnets with MTU 9000" {
  fixture_ring
  python3 "$TOP_PY" render "$FIX/ring.yaml" --out "$OUT"
  local addrs
  addrs="$(grep -rhoE '192\.168\.[0-9]+\.[0-9]+/24' "$OUT/ansible/files/generated/netplan/" | sort -u)"
  [ "$(echo "$addrs" | wc -l | tr -d ' ')" -eq 6 ]
  local f
  for f in spark0 spark1 spark2; do
    grep -q 'mtu: 9000' "$OUT/ansible/files/generated/netplan/${f}-99-highspeed.yaml"
    # Each ring node sits on exactly two links.
    [ "$(grep -c 'dhcp4: false' "$OUT/ansible/files/generated/netplan/${f}-99-highspeed.yaml")" -eq 2 ]
  done
}

@test "render switch netplan gives each node one MTU-9000 link" {
  fixture_switch 5
  python3 "$TOP_PY" render "$FIX/switch-5.yaml" --out "$OUT"
  local i f
  for i in 0 1 2 3 4; do
    f="$(printf 'spark%d' "$i")"
    grep -q "192.168.11${i}.1/24" "$OUT/ansible/files/generated/netplan/${f}-99-highspeed.yaml"
    grep -q 'mtu: 9000' "$OUT/ansible/files/generated/netplan/${f}-99-highspeed.yaml"
    [ "$(grep -c 'dhcp4: false' "$OUT/ansible/files/generated/netplan/${f}-99-highspeed.yaml")" -eq 1 ]
  done
}

@test "render emits fabric group vars with movable control plane" {
  fixture_switch 4
  python3 "$TOP_PY" render "$FIX/switch-4.yaml" --out "$OUT"
  local gv="$OUT/ansible/inventory/group_vars/generated/fabric.yml"
  [ -f "$gv" ]
  grep -q 'k3s_control_plane: "spark0"' "$gv"
  grep -q 'lab_fabric: "switch"' "$gv"
  grep -q 'lab_switch_host: "10.0.0.2"' "$gv"
}

@test "render emits cloud-init user-data per node with the node netplan" {
  fixture_pair
  python3 "$TOP_PY" render "$FIX/pair.yaml" --out "$OUT"
  local ud="$OUT/ansible/files/generated/cloud-init/user-data-spark0.yaml"
  [ -f "$ud" ]
  grep -q 'hostname: spark0' "$ud"
  grep -q '192.168.100.1/24' "$ud"
}

@test "render is idempotent" {
  fixture_ring
  python3 "$TOP_PY" render "$FIX/ring.yaml" --out "$OUT"
  local out2="$BATS_TMPDIR/lab-out-2"
  python3 "$TOP_PY" render "$FIX/ring.yaml" --out "$out2"
  run diff -r "$OUT/ansible" "$out2/ansible"
  [ "$status" -eq 0 ]
}

@test "topology_validate shell wrapper passes on the reference lab.yaml" {
  run topology_validate
  [ "$status" -eq 0 ]
}

@test "topology_facts shell wrapper emits orchestrator" {
  run topology_facts
  [ "$status" -eq 0 ]
  [[ "$output" == *$'orchestrator=spark0'* ]]
}

@test "topology_render shell wrapper renders into a target root" {
  run topology_render "$OUT"
  [ "$status" -eq 0 ]
  [ -f "$OUT/ansible/inventory/hosts.ini" ]
  [ -f "$OUT/ansible/inventory/group_vars/generated/fabric.yml" ]
}
