import * as ecs from '@8thwall/ecs'

// Shared data object for camera angles (independent from ball-controller)
const rocketCameraData = {
  azimuthAngle: 0,
}

const rocketController = ecs.registerComponent({
  name: 'rocketController',
  schema: {
    torqueStrength: ecs.f32,      // Rocket rotation torque strength
    mainThrustForce: ecs.f32,     // Main engine thrust force (upward)
    lateralThrustForce: ecs.f32,  // Side thruster force for horizontal movement
    rotationDamping: ecs.f32,     // Damping factor for rotation (stability)
    maxTiltAngle: ecs.f32,        // Maximum tilt angle in radians
    particleSystem: ecs.eid,
  },
  schemaDefaults: {
    torqueStrength: 5.0,       // Gentler rotation for precise control
    mainThrustForce: 35.0,     // Strong main engine for lifting
    lateralThrustForce: 8.0,   // Weaker side thrusters
    rotationDamping: 0.95,     // Slight damping for stability
    maxTiltAngle: 0.52,        // ~30 degrees max tilt
  },
  data: {
    isGrounded: ecs.boolean,   // Tracks if the rocket is touching the ground
    collisionCount: ecs.i32,   // Counts active collisions
    lastPositionX: ecs.f32,    // Previous X position for velocity calculation
    lastPositionY: ecs.f32,    // Previous Y position for velocity calculation
    lastPositionZ: ecs.f32,    // Previous Z position for velocity calculation
    velocityX: ecs.f32,        // Current velocity X component
    velocityZ: ecs.f32,        // Current velocity Z component
    isThrusting: ecs.boolean,  // Tracks if currently applying thrust
    isActive: ecs.boolean,     // Whether this controller is currently active
    // Store quaternion components to track entity rotation
    quatX: ecs.f32,
    quatY: ecs.f32,
    quatZ: ecs.f32,
    quatW: ecs.f32,
  },
  stateMachine: ({world, eid, dataAttribute}) => {
    // Helper function to update grounded state based on collisions
    const updateGroundedState = () => {
      const data = dataAttribute.cursor(eid)
      data.isGrounded = data.collisionCount > 0
    }

    // Handle start of a collision
    const handleCollisionStart = () => {
      const data = dataAttribute.cursor(eid)
      data.collisionCount++
      updateGroundedState()
    }

    // Handle end of a collision
    const handleCollisionEnd = () => {
      const data = dataAttribute.cursor(eid)
      data.collisionCount = Math.max(0, data.collisionCount - 1)
      updateGroundedState()
    }

    // Handle vehicle controller change events
    const handleVehicleChange = (event: any) => {
      const data = dataAttribute.cursor(eid)
      // Check if the event is for this entity
      if (event.data.vehicleEid === eid) {
        // Update active state based on the controller type
        data.isActive = (event.data.controller === 'rocket')
      }
    }

    ecs.defineState('active').initial()
      .onEnter(() => {
        // Initialize controller data
        const data = dataAttribute.cursor(eid)
        data.isGrounded = false
        data.collisionCount = 0
        data.isThrusting = false
        data.isActive = false  // Default to inactive (will be updated by events)

        // Initialize with current position
        const currentPos = world.transform.getWorldPosition(eid)
        data.lastPositionX = currentPos.x
        data.lastPositionY = currentPos.y
        data.lastPositionZ = currentPos.z
        data.velocityX = 0
        data.velocityZ = 0

        // Initialize quaternion (identity = no rotation)
        data.quatX = 0
        data.quatY = 0
        data.quatZ = 0
        data.quatW = 1

        // Set up collision listeners
        world.events.addListener(eid, ecs.physics.COLLISION_START_EVENT, handleCollisionStart)
        world.events.addListener(eid, ecs.physics.COLLISION_END_EVENT, handleCollisionEnd)

        // Listen for global vehicle controller change events
        world.events.addListener(world.events.globalId, 'vehicle-controller-changed', handleVehicleChange)

        updateGroundedState()
      })
      .onExit(() => {
        // Clean up all listeners
        world.events.removeListener(eid, ecs.physics.COLLISION_START_EVENT, handleCollisionStart)
        world.events.removeListener(eid, ecs.physics.COLLISION_END_EVENT, handleCollisionEnd)
        world.events.removeListener(world.events.globalId, 'vehicle-controller-changed', handleVehicleChange)
      })

    dataAttribute.set(eid, {
      isGrounded: false,
      collisionCount: 0,
      lastPositionX: 0,
      lastPositionY: 0,
      lastPositionZ: 0,
      velocityX: 0,
      velocityZ: 0,
      isThrusting: false,
      isActive: false,
      quatX: 0,
      quatY: 0,
      quatZ: 0,
      quatW: 1,
    })
  },
  tick: (world, component) => {
    const {eid} = component
    const schema = rocketController.get(world, eid)
    const {data} = component

    // Check if this controller is active
    if (!data.isActive) {
      // Rocket controller is not active, skip processing
      return
    }

    // Get current position
    const currentPos = world.transform.getWorldPosition(eid)

    // Calculate velocity based on position changes
    const deltaX = currentPos.x - data.lastPositionX
    const deltaZ = currentPos.z - data.lastPositionZ

    // Calculate velocity (skip first frame to avoid large initial values)
    const isFirstFrame = (data.lastPositionX === 0 && data.lastPositionY === 0 && data.lastPositionZ === 0)
    if (!isFirstFrame && world.time.delta > 0) {
      // Update velocity with some smoothing to reduce jitter
      const smoothingFactor = 0.7  // Increased smoothing for smoother velocity tracking
      data.velocityX = data.velocityX * smoothingFactor + (deltaX / world.time.delta) * (1 - smoothingFactor)
      data.velocityZ = data.velocityZ * smoothingFactor + (deltaZ / world.time.delta) * (1 - smoothingFactor)
    }

    // Store current position for next frame's velocity calculation
    data.lastPositionX = currentPos.x
    data.lastPositionY = currentPos.y
    data.lastPositionZ = currentPos.z

    // Try to get the entity's current rotation if it has a Quaternion component
    const quaternion = ecs.Quaternion?.get?.(world, eid)
    if (quaternion) {
      // Store the current quaternion for calculating local vectors
      data.quatX = quaternion.x
      data.quatY = quaternion.y
      data.quatZ = quaternion.z
      data.quatW = quaternion.w
    }

    if (data.isThrusting === true) {
      ecs.ParticleEmitter.set(world, schema.particleSystem, {
        stopped: false,
      })
    } else {
      ecs.ParticleEmitter.set(world, schema.particleSystem, {
        stopped: true,
      })
    }

    // Helper function to rotate a vector by a quaternion
    function rotateVectorByQuat(vec: { x: number, y: number, z: number }, qx: number, qy: number, qz: number, qw: number) {
      // Calculate quat * vec * quat^-1
      const ix = qw * vec.x + qy * vec.z - qz * vec.y
      const iy = qw * vec.y + qz * vec.x - qx * vec.z
      const iz = qw * vec.z + qx * vec.y - qy * vec.x
      const iw = -qx * vec.x - qy * vec.y - qz * vec.z

      return {
        x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
        y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
        z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
      }
    }

    // Calculate the entity's local vectors from its quaternion
    const localUp = rotateVectorByQuat({x: 0, y: 1, z: 0}, data.quatX, data.quatY, data.quatZ, data.quatW)
    const localRight = rotateVectorByQuat({x: 1, y: 0, z: 0}, data.quatX, data.quatY, data.quatZ, data.quatW)
    const localForward = rotateVectorByQuat({x: 0, y: 0, z: -1}, data.quatX, data.quatY, data.quatZ, data.quatW)

    // Get camera direction for camera-relative controls
    const {azimuthAngle} = rocketCameraData

    // Calculate camera's forward and right vectors in world space
    const camForwardX = -Math.sin(azimuthAngle)
    const camForwardZ = -Math.cos(azimuthAngle)
    const camRightX = Math.cos(azimuthAngle)
    const camRightZ = -Math.sin(azimuthAngle)

    // Lunar lander style controls
    const {isGrounded} = data

    // Check if stabilize mode is active
    const isStabilizing = world.input.getAction('modify')

    if (isStabilizing) {
      // STABILIZE MODE: Reorient to upright and apply directional forces

      // Calculate how far we are from upright (0,0,0 rotation)
      // We want local up to align with world up (0,1,0)
      // And local forward to align with world forward (0,0,-1)

      // Calculate error angles
      const pitchError = Math.atan2(localUp.z, localUp.y)  // Rotation around X
      const rollError = Math.atan2(-localUp.x, localUp.y)  // Rotation around Z
      const yawError = Math.atan2(-localForward.x, -localForward.z)  // Rotation around Y

      // Set angular velocity directly for smooth stabilization
      const stabilizeSpeed = 5.0  // Speed of stabilization
      const angVelX = -pitchError * stabilizeSpeed
      const angVelY = -yawError * stabilizeSpeed
      const angVelZ = -rollError * stabilizeSpeed

      // Directly set angular velocity to avoid oscillation
      ecs.physics.setAngularVelocity(world, eid, angVelX, angVelY, angVelZ)

      // Apply directional forces based on input (camera-relative)
      let forceX = 0
      let forceZ = 0

      if (world.input.getAction('forward')) {
        forceX += camForwardX * schema.lateralThrustForce * 2.0  // Stronger force in stabilize mode
        forceZ += camForwardZ * schema.lateralThrustForce * 2.0
      }
      if (world.input.getAction('backward')) {
        forceX -= camForwardX * schema.lateralThrustForce * 2.0
        forceZ -= camForwardZ * schema.lateralThrustForce * 2.0
      }
      if (world.input.getAction('left')) {
        forceX -= camRightX * schema.lateralThrustForce * 2.0
        forceZ -= camRightZ * schema.lateralThrustForce * 2.0
      }
      if (world.input.getAction('right')) {
        forceX += camRightX * schema.lateralThrustForce * 2.0
        forceZ += camRightZ * schema.lateralThrustForce * 2.0
      }

      // Apply the directional forces
      if (forceX !== 0 || forceZ !== 0) {
        ecs.physics.applyForce(world, eid, forceX, 0, forceZ)
      }
    } else {
      // NORMAL MODE: Tilt-based control

      // Calculate desired tilt direction based on camera-relative input
      let tiltX = 0  // Desired tilt in world X
      let tiltZ = 0  // Desired tilt in world Z

      // Forward/backward input relative to camera
      if (world.input.getAction('forward')) {
        tiltX -= camForwardX * schema.torqueStrength
        tiltZ -= camForwardZ * schema.torqueStrength
      }
      if (world.input.getAction('backward')) {
        tiltX += camForwardX * schema.torqueStrength
        tiltZ += camForwardZ * schema.torqueStrength
      }

      // Left/right input relative to camera
      if (world.input.getAction('left')) {
        tiltX += camRightX * schema.torqueStrength
        tiltZ += camRightZ * schema.torqueStrength
      }
      if (world.input.getAction('right')) {
        tiltX -= camRightX * schema.torqueStrength
        tiltZ -= camRightZ * schema.torqueStrength
      }

      // Convert desired tilt to torque
      // Torque around X axis controls Z-direction tilt
      // Torque around Z axis controls X-direction tilt
      let torqueX = -tiltZ  // Negative because of axis orientation
      let torqueZ = tiltX   // Positive for correct direction

      // Apply rotation damping for stability (prevents spinning out of control)
      // Get current angular velocity and apply damping
      const angularVelocity = ecs.physics.getAngularVelocity(world, eid)
      if (angularVelocity && schema.rotationDamping < 1) {
        const dampingTorqueX = -angularVelocity.x * (1 - schema.rotationDamping) * 10
        const dampingTorqueY = -angularVelocity.y * (1 - schema.rotationDamping) * 10
        const dampingTorqueZ = -angularVelocity.z * (1 - schema.rotationDamping) * 10

        torqueX += dampingTorqueX
        torqueZ += dampingTorqueZ

        // Also damp Y rotation to prevent unwanted spinning
        ecs.physics.applyTorque(world, eid, torqueX, dampingTorqueY, torqueZ)
      } else {
        // Apply torque without damping if we can't get angular velocity
        if (torqueX !== 0 || torqueZ !== 0) {
          ecs.physics.applyTorque(world, eid, torqueX, 0, torqueZ)
        }
      }
    }  // End of normal mode

    // Main thrust control (jump button)
    if (world.input.getAction('jump')) {
      // Apply main thrust along the lander's local up vector
      // This provides lift and, when tilted, horizontal movement
      const thrustX = localUp.x * schema.mainThrustForce
      const thrustY = localUp.y * schema.mainThrustForce
      const thrustZ = localUp.z * schema.mainThrustForce

      ecs.physics.applyForce(world, eid, thrustX, thrustY, thrustZ)

      if (!data.isThrusting) {
        data.isThrusting = true
      }

      // Optional: Add small lateral thrusters for fine control (only in normal mode)
      // These work even when not tilted, for precise positioning
      // Also camera-relative for consistency
      if (!isStabilizing) {
        let lateralX = 0
        let lateralZ = 0

        if (world.input.getAction('forward')) {
          lateralX -= camForwardX * schema.lateralThrustForce * 0.3
          lateralZ -= camForwardZ * schema.lateralThrustForce * 0.3
        }
        if (world.input.getAction('backward')) {
          lateralX += camForwardX * schema.lateralThrustForce * 0.3
          lateralZ += camForwardZ * schema.lateralThrustForce * 0.3
        }
        if (world.input.getAction('left')) {
          lateralX += camRightX * schema.lateralThrustForce * 0.3
          lateralZ += camRightZ * schema.lateralThrustForce * 0.3
        }
        if (world.input.getAction('right')) {
          lateralX -= camRightX * schema.lateralThrustForce * 0.3
          lateralZ -= camRightZ * schema.lateralThrustForce * 0.3
        }

        if (lateralX !== 0 || lateralZ !== 0) {
          ecs.physics.applyForce(world, eid, lateralX, 0, lateralZ)
        }
      }
    } else {
      if (data.isThrusting) {
        data.isThrusting = false
      }

      // When not thrusting, only apply stabilization torque if needed (and not in stabilize mode)
      // This helps the lander naturally right itself
      if (!isStabilizing) {
        const uprightDot = localUp.y  // How aligned are we with world up?
        if (uprightDot < 0.95 && !world.input.getAction('forward') && !world.input.getAction('backward') &&
          !world.input.getAction('left') && !world.input.getAction('right')) {
          // Apply gentle self-righting torque
          const rightingTorqueX = -localUp.x * 2.0
          const rightingTorqueZ = -localUp.z * 2.0
          ecs.physics.applyTorque(world, eid, rightingTorqueX, 0, rightingTorqueZ)
        }
      }
    }
  },
})

export {rocketController, rocketCameraData}
